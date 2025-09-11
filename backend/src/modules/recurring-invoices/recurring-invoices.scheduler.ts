import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringInvoicesService } from './recurring-invoices.service';

@Injectable()
export class RecurringInvoiceScheduler {
  private readonly logger = new Logger(RecurringInvoiceScheduler.name);

  constructor(private readonly recurringService: RecurringInvoicesService) {}

  // Run hourly to process due recurring invoices
  @Cron(CronExpression.EVERY_HOUR)
  async processDueRecurringInvoices() {
    try {
      const { processed } = await this.recurringService.processDue();
      if (processed > 0) {
        this.logger.log(
          `Processed ${processed} due recurring invoice template(s).`,
        );
      }
    } catch (e) {
      this.logger.error('Failed processing due recurring invoices', e);
    }
  }
}
