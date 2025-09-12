import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StripeService } from './stripe.service';

@Controller()
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  // Admin SaaS subscription checkout (for current authenticated user)
  @Post('payments/stripe/subscription/checkout')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  createSubscriptionCheckout(
    @CurrentUser() user: any,
    @Body() body: { plan?: 'BASIC' | 'PREMIUM'; force?: boolean },
  ) {
    const plan = body?.plan === 'BASIC' ? 'BASIC' : 'PREMIUM';
    return this.stripe.createSubscriptionCheckoutSession(user.id, plan, !!body?.force);
  }

  @Post('payments/stripe/subscription/portal')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  createPortal(@CurrentUser() user: any) {
    return this.stripe.createBillingPortalSession(user.id);
  }

  // Manual sync of subscription state (fallback when webhook is delayed)
  @Post('payments/stripe/subscription/sync')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  syncSubscription(@CurrentUser() user: any) {
    return this.stripe.syncSubscriptionForUser(user.id);
  }

  // User payments: Stripe Connect onboarding/status
  @Post('payments/stripe/connect/onboarding')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  createConnectOnboarding(@CurrentUser() user: any) {
    return this.stripe.createConnectOnboardingLink(user.id);
  }

  @Get('payments/stripe/connect/status')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  getConnectStatus(@CurrentUser() user: any) {
    return this.stripe.getConnectStatus(user.id);
  }

  @Get('payments/stripe/subscription/debug')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  debugSubscriptions(@CurrentUser() user: any) {
    return this.stripe.debugUserSubscriptions(user.id);
  }

  // Webhook endpoint (no auth)
  @Post('webhooks/stripe')
  async webhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature?: string,
  ) {
    // req['rawBody'] is available because app.enable rawBody in NestFactory.create({ rawBody: true })
    const raw = (req as any).rawBody as Buffer;
    return this.stripe.handleWebhook(raw, signature);
  }
}
