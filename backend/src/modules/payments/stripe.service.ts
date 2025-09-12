import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

// Utility to read a set of keys from SystemSettings
async function readSettings(prisma: PrismaService, keys: string[]) {
  const rows = await prisma.systemSettings.findMany({
    where: { key: { in: keys } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value])) as Map<string, any>;
  return map;
}

@Injectable()
export class StripeService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private async getStripe(): Promise<Stripe> {
    const map = await readSettings(this.prisma, ['STRIPE_SECRET_KEY']);
    const sk = String(map.get('STRIPE_SECRET_KEY') || '');
    if (!sk || sk === '__SECRET__') {
      throw new BadRequestException(
        'Stripe is not configured (missing STRIPE_SECRET_KEY)',
      );
    }
    return new Stripe(sk, { apiVersion: '2024-11-20.acacia' as any });
  }

  // --- Admin SaaS subscription billing ---
  private async getPrices(): Promise<{ BASIC?: string; PREMIUM?: string }> {
    const map = await readSettings(this.prisma, [
      'STRIPE_PRICE_BASIC',
      'STRIPE_PRICE_PREMIUM',
    ]);
    return {
      BASIC: map.get('STRIPE_PRICE_BASIC')
        ? String(map.get('STRIPE_PRICE_BASIC'))
        : undefined,
      PREMIUM: map.get('STRIPE_PRICE_PREMIUM')
        ? String(map.get('STRIPE_PRICE_PREMIUM'))
        : undefined,
    };
  }

  private getFrontendUrl(): string {
    // Prefer configured FRONTEND_ORIGINS first value, else default to localhost:3000
    const origins = (process.env.FRONTEND_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return origins[0] || 'http://localhost:3000';
  }

  private async ensureStripeCustomerId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if ((user as any).stripeCustomerId) return (user as any).stripeCustomerId;
    const stripe = await this.getStripe();
    // Try to find an existing customer for this email to prevent duplicates.
    // Prefer a customer that already has a non-canceled subscription.
    let chosenCustomerId: string | undefined;
    try {
      const list = await stripe.customers.list({ email: user.email, limit: 10 });
      // Try to find a customer with an active/trialing/past_due/unpaid subscription
      for (const c of list.data) {
        try {
          const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 10 });
          const hasValid = subs.data.some((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired');
          if (hasValid) { chosenCustomerId = c.id; break; }
        } catch {}
      }
      // If none have subscriptions, pick the most recently created
      if (!chosenCustomerId && list.data.length > 0) {
        const sorted = list.data.sort((a, b) => (b.created || 0) - (a.created || 0));
        chosenCustomerId = sorted[0].id;
      }
    } catch {}
    const customer = chosenCustomerId
      ? await stripe.customers.retrieve(chosenCustomerId).then((c) => c as any)
      : await stripe.customers.create({
          email: user.email,
          name:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        });
    const prismaAny = this.prisma as any;
    await prismaAny.user.update({
      where: { id: userId },
      data: { stripeCustomerId: (customer as any).id },
    });
    return (customer as any).id;
  }

  async createSubscriptionCheckoutSession(
    userId: string,
    plan: 'BASIC' | 'PREMIUM',
    force?: boolean,
  ) {
    const stripe = await this.getStripe();
    const prices = await this.getPrices();
    const priceId = plan === 'BASIC' ? prices.BASIC : prices.PREMIUM;
    if (!priceId)
      throw new BadRequestException(
        `Stripe price for ${plan} is not configured`,
      );
    const customer = await this.ensureStripeCustomerId(userId);

    // If the customer already has a still-active subscription that is NOT set to cancel at period end,
    // send them to the billing portal to manage/upgrade instead of creating a duplicate subscription.
    const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
    const hasBlocking = subs.data.some((s) => {
      const status = s.status as string;
      const blockingStatus = status === 'active' || status === 'trialing' || status === 'past_due' || status === 'unpaid';
      return blockingStatus && !s.cancel_at_period_end;
    });
    try {
      console.log('[Stripe] createSubscriptionCheckoutSession', {
        userId,
        plan,
        subs: subs.data.map((s) => ({ id: s.id, status: s.status, cancel_at_period_end: s.cancel_at_period_end })),
        hasBlocking,
        force: !!force,
      });
    } catch {}
    if (hasBlocking && !force) {
      // Return billing portal URL instead of a checkout session.
      return this.createBillingPortalSession(userId);
    }

    const origin = this.getFrontendUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?tab=billing&success=1`,
      cancel_url: `${origin}/settings?tab=billing&canceled=1`,
      metadata: { type: 'subscription', userId, plan },
    });
    return { url: session.url };
  }

  // Debug helper: return the user's Stripe subscriptions and our blocking decision
  async debugUserSubscriptions(userId: string) {
    const stripe = await this.getStripe();
    const customer = await this.ensureStripeCustomerId(userId);
    const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 20 });
    const items = subs.data.map((s) => ({
      id: s.id,
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      current_period_end: s.current_period_end,
      created: s.created,
      items: s.items?.data?.map((it: any) => ({ price: it.price?.id, product: it.price?.product })) || [],
    }));
    const hasBlocking = subs.data.some((s) => {
      const status = s.status as string;
      const blockingStatus = status === 'active' || status === 'trialing' || status === 'past_due' || status === 'unpaid';
      return blockingStatus && !s.cancel_at_period_end;
    });
    return { customer, subscriptions: items, hasBlocking } as const;
  }

  async createBillingPortalSession(userId: string) {
    const stripe = await this.getStripe();
    const customer = await this.ensureStripeCustomerId(userId);
    const origin = this.getFrontendUrl();
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/settings?tab=billing&from=portal`,
    });
    return { url: portal.url };
  }

  // Manually sync subscription status for a user from Stripe (fallback when webhooks are delayed)
  async syncSubscriptionForUser(userId: string) {
    const stripe = await this.getStripe();
    const customer = await this.ensureStripeCustomerId(userId);
    const prices = await this.getPrices();
    const prev = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionPlan: true,
        emailNotificationsEnabled: true,
        email: true,
        firstName: true,
        companyName: true,
      },
    });
    // Look for the most recent non-canceled subscription for this customer
    const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
    let plan: 'FREE' | 'BASIC' | 'PREMIUM' = 'FREE';
    let periodEnd: Date | null = null;
    // Prefer subscriptions that are not canceled or incomplete_expired
    const sorted = subs.data
      .filter((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired')
      .sort((a, b) => (b.created || 0) - (a.created || 0));
    if (sorted.length > 0) {
      const sub = sorted[0];
      const item = sub.items?.data?.[0];
      const priceId = (item as any)?.price?.id as string | undefined;
      if (priceId && prices.BASIC && priceId === prices.BASIC) plan = 'BASIC';
      else if (priceId && prices.PREMIUM && priceId === prices.PREMIUM) plan = 'PREMIUM';
      periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    }
    const invoiceLimit = plan === 'FREE' ? 5 : plan === 'BASIC' ? 50 : 0;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: plan as any,
        subscriptionEnd: periodEnd,
        invoiceLimit,
      },
    });
    // Fire plan upgraded email if changed to a paid plan and notifications enabled
    try {
      if (
        (prev?.subscriptionPlan as any) !== (plan as any) &&
        plan !== 'FREE' &&
        prev?.emailNotificationsEnabled
      ) {
        await this.emailService.sendPlanUpgradedEmail(
          {
            email: prev?.email,
            firstName: prev?.firstName,
            companyName: prev?.companyName,
          } as any,
          String(plan),
          periodEnd,
          invoiceLimit,
        );
      }
    } catch (e) {
      console.error('Failed to send plan upgraded email (sync):', (e as any)?.message || e);
    }
    return { subscriptionPlan: plan, subscriptionEnd: periodEnd, invoiceLimit } as const;
  }

  // --- Stripe Connect for user invoice payments ---
  async createOrGetConnectAccount(userId: string) {
    const stripe = await this.getStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if ((user as any).stripeConnectAccountId)
      return (user as any).stripeConnectAccountId;
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: user.companyEmail || user.email,
      business_type: 'individual',
      metadata: { userId },
    });
    const prismaAny = this.prisma as any;
    await prismaAny.user.update({
      where: { id: userId },
      data: { stripeConnectAccountId: account.id },
    });
    return account.id;
  }

  async createConnectOnboardingLink(userId: string) {
    const stripe = await this.getStripe();
    const accountId = await this.createOrGetConnectAccount(userId);
    const origin = this.getFrontendUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings?tab=billing&connect=refresh`,
      return_url: `${origin}/settings?tab=billing&connect=return`,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  async getConnectStatus(userId: string) {
    const stripe = await this.getStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!(user as any).stripeConnectAccountId) return { connected: false };
    const acct = await stripe.accounts.retrieve(
      (user as any).stripeConnectAccountId,
    );
    const detailsSubmitted = (acct as any)?.details_submitted || false;
    const chargesEnabled = (acct as any)?.charges_enabled || false;
    return {
      connected: !!(user as any).stripeConnectAccountId,
      detailsSubmitted,
      chargesEnabled,
    };
  }

  // Create a Checkout session for paying an invoice by shareId using destination charges to a user's connected account
  async createInvoiceCheckoutByShareId(shareId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { shareId, shareEnabled: true },
      include: { user: true, client: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const amountDue = Math.max(
      0,
      Math.round((invoice.balanceDue || invoice.totalAmount) * 100),
    ); // in cents
    if (amountDue <= 0)
      throw new BadRequestException('Invoice has no balance due');

    const currency = (invoice.currency || 'USD').toLowerCase();
    const stripe = await this.getStripe();

    const platformFeeBpsRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'STRIPE_PLATFORM_FEE_BPS' },
    });
    const feeBps = Number(platformFeeBpsRow?.value || 0);
    const application_fee_amount = Math.floor(
      (amountDue * Math.max(0, Math.min(10000, feeBps))) / 10000,
    );

    // Enforce that the invoice owner's Stripe Connect account is set up
    const destination = (invoice.user as any).stripeConnectAccountId;
    if (!destination) {
      throw new BadRequestException(
        'Payment is not available yet. The seller has not connected Stripe. Please contact them to set up payments.',
      );
    }
    // Verify charges are enabled on the connected account
    try {
      const acct = await stripe.accounts.retrieve(destination);
      const chargesEnabled = (acct as any)?.charges_enabled;
      if (!chargesEnabled) {
        throw new BadRequestException(
          'Payment is not available yet. The seller’s Stripe account is not fully enabled for charges.',
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        'Unable to verify seller’s Stripe account. Please try again later.',
      );
    }

    const origin = this.getFrontendUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: invoice.client?.name
                ? `Client: ${invoice.client.name}`
                : undefined,
            },
            unit_amount: amountDue,
          },
          quantity: 1,
        },
      ],
      customer_email: invoice.client?.email || undefined,
      success_url: `${origin}/public/invoices/${encodeURIComponent(shareId)}?paid=1`,
      cancel_url: `${origin}/public/invoices/${encodeURIComponent(shareId)}?canceled=1`,
      metadata: {
        type: 'invoice_payment',
        invoiceId: invoice.id,
        userId: invoice.userId,
        shareId,
      },
      payment_intent_data: {
        transfer_data: { destination },
        application_fee_amount,
      },
    });

    return { url: session.url };
  }

  // --- Webhook handling ---
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const map = await readSettings(this.prisma, [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_BASIC',
      'STRIPE_PRICE_PREMIUM',
    ]);
    const sk = String(map.get('STRIPE_SECRET_KEY') || '');
    const wh = String(map.get('STRIPE_WEBHOOK_SECRET') || '');
    if (!sk || !wh) throw new BadRequestException('Stripe is not configured');
    const stripe = new Stripe(sk, { apiVersion: '2024-11-20.acacia' as any });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature || '', wh);
    } catch (err: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err?.message || err}`,
      );
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const type = (session.metadata as any)?.type;
        if (type === 'invoice_payment') {
          await this.onInvoicePaymentSessionCompleted(session);
        } else if (type === 'subscription') {
          await this.onSubscriptionSessionCompleted(session);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (customerId) await this.onSubscriptionCanceled(customerId);
        break;
      }
      default:
        // noop
        break;
    }

    return { received: true };
  }

  private async onInvoicePaymentSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const invoiceId = (session.metadata as any)?.invoiceId;
    const userId = (session.metadata as any)?.userId;
    if (!invoiceId || !userId) return;
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true, client: true, user: true },
    });
    if (!invoice) return;

    const paidCents = session.amount_total || 0;
    const paid = Math.max(0, paidCents / 100);

    // Create a payment record
    await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: paid,
        paymentMethod: 'STRIPE' as any,
        paymentDate: new Date(),
        transactionId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.id,
        status: 'COMPLETED' as any,
        notes: 'Stripe Checkout payment',
        paymentNumber: `PMT-${Date.now()}`,
        netAmount: paid,
      },
    });

    // Update invoice totals and status
    const newTotalPaid =
      (invoice.payments || [])
        .filter((p) => p.status === 'COMPLETED')
        .reduce((s, p) => s + p.amount, 0) + paid;

    const fullyPaid = newTotalPaid >= invoice.totalAmount - 0.0001;
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: fullyPaid ? ('PAID' as any) : ('PARTIALLY_PAID' as any),
        paidAmount: newTotalPaid,
        balanceDue: Math.max(0, invoice.totalAmount - newTotalPaid),
        paidAt: fullyPaid ? new Date() : invoice.paidAt,
      },
    });

    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: invoice.id,
        action: 'PAYMENT_RECEIVED' as any,
        description: `Stripe payment of ${paid.toFixed(2)} received via Checkout`,
        performedBy: userId,
      },
    });

    // Send emails (respect preferences)
    try {
      if (
        invoice.user?.emailNotificationsEnabled &&
        invoice.user?.emailNotifyPaymentReceived
      ) {
        await this.emailService.sendPaymentReceivedEmail(
          invoice.user as any,
          invoice.client as any,
          invoice as any,
          paid,
        );
      }
      if (invoice.user?.emailNotificationsEnabled) {
        const updatedBalance = Math.max(
          0,
          (invoice.totalAmount || 0) - ((invoice.paidAmount || 0) + paid),
        );
        await this.emailService.sendClientPaymentReceiptEmail(
          invoice.client as any,
          {
            ...invoice,
            paidAmount: (invoice.paidAmount || 0) + paid,
            balanceDue: updatedBalance,
          } as any,
          paid,
          invoice.user as any,
        );
      }
    } catch (e) {
      console.error(
        'Failed to send payment email after Stripe payment:',
        e?.message || e,
      );
    }
  }

  private async onSubscriptionSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const userId = (session.metadata as any)?.userId;
    const plan = (session.metadata as any)?.plan as 'BASIC' | 'PREMIUM';
    if (!userId || !plan) return;

    // Retrieve the subscription to get current period end
    const stripe = await this.getStripe();
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id;
    let periodEnd: Date | null = null;
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const endTs = sub.current_period_end || 0;
      periodEnd = endTs ? new Date(endTs * 1000) : null;
    }

    const invoiceLimit = plan === 'BASIC' ? 50 : 0;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: plan as any,
        subscriptionEnd: periodEnd,
        invoiceLimit,
      },
      select: {
        emailNotificationsEnabled: true,
        email: true,
        firstName: true,
        companyName: true,
        subscriptionPlan: true,
        subscriptionEnd: true,
        invoiceLimit: true,
      },
    });

    // Send plan upgraded email (best-effort)
    try {
      if (updated?.emailNotificationsEnabled) {
        await this.emailService.sendPlanUpgradedEmail(
          {
            email: updated.email,
            firstName: updated.firstName,
            companyName: updated.companyName,
          } as any,
          String(plan),
          periodEnd,
          invoiceLimit,
        );
      }
    } catch (e) {
      console.error('Failed to send plan upgraded email:', (e as any)?.message || e);
    }
  }

  private async onSubscriptionCanceled(customerId: string) {
    const prismaAny = this.prisma as any;
    const user = await prismaAny.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!user) return;
    await prismaAny.user.update({
      where: { id: user.id },
      data: {
        subscriptionPlan: 'FREE' as any,
        subscriptionEnd: null,
        invoiceLimit: 5,
      },
    });
  }
}
