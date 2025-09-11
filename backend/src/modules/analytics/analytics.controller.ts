import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardStats(@CurrentUser() user) {
    return this.analyticsService.getDashboardStats(user.id);
  }

  @Get('revenue')
  getRevenueAnalytics(
    @CurrentUser() user,
    @Query('period') period?: 'week' | 'month' | 'year',
  ) {
    return this.analyticsService.getRevenueAnalytics(
      user.id,
      period || 'month',
    );
  }

  @Get('invoices')
  getInvoiceAnalytics(@CurrentUser() user) {
    return this.analyticsService.getInvoiceAnalytics(user.id);
  }

  @Get('clients')
  getClientAnalytics(@CurrentUser() user) {
    return this.analyticsService.getClientAnalytics(user.id);
  }

  @Get('payments')
  getPaymentAnalytics(@CurrentUser() user) {
    return this.analyticsService.getPaymentAnalytics(user.id);
  }
}
