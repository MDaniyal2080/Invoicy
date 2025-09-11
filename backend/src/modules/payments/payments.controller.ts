import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentStatus, PaymentMethod } from '../../common/enums';

@Controller('payments')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('record')
  create(@CurrentUser() user, @Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(user.id, createPaymentDto);
  }

  @Post('process')
  processPayment(
    @CurrentUser() user,
    @Body() processPaymentDto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(user.id, processPaymentDto);
  }

  @Get('statistics')
  getStatistics(@CurrentUser() user) {
    return this.paymentsService.getPaymentStatistics(user.id);
  }

  @Get()
  findAll(
    @CurrentUser() user,
    @Query('invoiceId') invoiceId?: string,
    @Query('status')
    status?: (typeof PaymentStatus)[keyof typeof PaymentStatus],
    @Query('method')
    method?: (typeof PaymentMethod)[keyof typeof PaymentMethod],
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: any = {
      invoiceId,
      status,
      method,
      search,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.paymentsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.paymentsService.findOne(id, user.id);
  }

  @Post(':id/refund')
  refund(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body('amount') amount?: number,
  ) {
    return this.paymentsService.refund(id, user.id, amount);
  }
}
