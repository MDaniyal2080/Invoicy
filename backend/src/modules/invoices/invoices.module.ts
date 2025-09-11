import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PublicInvoicesController } from './public-invoices.controller';
import { PdfService } from './pdf.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceOverdueScheduler } from './invoice-overdue.scheduler';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [InvoicesService, PdfService, InvoiceOverdueScheduler],
  exports: [InvoicesService],
})
export class InvoicesModule {}
