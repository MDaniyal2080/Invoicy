import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { RecurringInvoicesController } from './recurring-invoices.controller';
import { RecurringInvoiceScheduler } from './recurring-invoices.scheduler';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [RecurringInvoicesController],
  providers: [RecurringInvoicesService, RecurringInvoiceScheduler],
  exports: [RecurringInvoicesService],
})
export class RecurringInvoicesModule {}
