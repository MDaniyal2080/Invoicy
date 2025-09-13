import { Body, Controller, Param, Post, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { StripeService } from './stripe.service';

// Public endpoints to allow payments by shareId (no auth)
// Routes:
// POST /public/invoices/:shareId/payments/record
// POST /public/invoices/:shareId/payments/process

@Controller('public/invoices')
export class PublicPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly invoicesService: InvoicesService,
    private readonly stripeService: StripeService,
  ) {}

  @Post(':shareId/payments/record')
  async recordPublic(
    @Param('shareId') shareId: string,
    @Body()
    body: {
      amount: number;
      paymentMethod:
        | 'CASH'
        | 'BANK_TRANSFER'
        | 'CREDIT_CARD'
        | 'DEBIT_CARD'
        | 'PAYPAL'
        | 'STRIPE'
        | 'CHECK'
        | 'OTHER';
      paymentDate?: string | Date;
      transactionId?: string;
      notes?: string;
    },
  ) {
    // Resolve invoice by shareId, then delegate to service with userId + invoiceId
    const invoice =
      await this.invoicesService.getPublicInvoiceByShareId(shareId);
    const payload = {
      invoiceId: invoice.id,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      transactionId: body.transactionId,
      notes: body.notes,
    } as any;
    return this.paymentsService.create(invoice.userId, payload);
  }

  @Post(':shareId/payments/process')
  async processPublic(
    @Param('shareId') shareId: string,
    @Body()
    body: {
      amount: number;
      paymentMethod:
        | 'CREDIT_CARD'
        | 'BANK_TRANSFER'
        | 'PAYPAL'
        | 'STRIPE'
        | 'CASH'
        | 'DEBIT_CARD'
        | 'CHECK'
        | 'OTHER';
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      bankAccount?: string;
      notes?: string;
    },
  ) {
    const invoice =
      await this.invoicesService.getPublicInvoiceByShareId(shareId);
    const payload = {
      invoiceId: invoice.id,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      cardNumber: body.cardNumber,
      cardExpiry: body.cardExpiry,
      cardCvv: body.cardCvv,
      bankAccount: body.bankAccount,
      notes: body.notes,
    } as any;
    return this.paymentsService.processPayment(invoice.userId, payload);
  }

  // Stripe Checkout (public) — returns a URL to redirect the client for card payment
  @Post(':shareId/payments/stripe/checkout')
  async createStripeCheckout(@Param('shareId') shareId: string) {
    return this.stripeService.createInvoiceCheckoutByShareId(shareId);
  }

  // Stripe Checkout verify (public) — fallback when webhooks are delayed or missing
  @Post(':shareId/payments/stripe/verify')
  async verifyStripeCheckout(
    @Param('shareId') shareId: string,
    @Body() body: { sessionId?: string },
  ) {
    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return this.stripeService.verifyInvoiceCheckoutSessionByShareId(
      shareId,
      sessionId,
    );
  }
}
