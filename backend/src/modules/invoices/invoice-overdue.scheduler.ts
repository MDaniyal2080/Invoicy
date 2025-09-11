import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus, HistoryAction } from '../../common/enums';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoiceOverdueScheduler {
  private readonly logger = new Logger(InvoiceOverdueScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  // Runs hourly; adjust as needed
  @Cron(CronExpression.EVERY_HOUR)
  async markOverdueInvoices() {
    const now = new Date();

    const candidates = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.VIEWED] },
        dueDate: { lt: now },
      },
      include: { client: true, user: true },
    });

    if (candidates.length === 0) return;

    const ids = candidates.map((c) => c.id);

    await this.prisma.$transaction([
      this.prisma.invoice.updateMany({
        where: { id: { in: ids } },
        data: { status: InvoiceStatus.OVERDUE },
      }),
      this.prisma.invoiceHistory.createMany({
        data: ids.map((id) => ({
          invoiceId: id,
          action: HistoryAction.STATUS_CHANGED,
          description: 'Status changed to OVERDUE (auto)',
          performedBy: null,
        })),
      }),
    ]);

    this.logger.log(`Marked ${ids.length} invoice(s) as OVERDUE`);

    // Send overdue reminders (one-time per transition) gated by user preferences
    for (const invoice of candidates) {
      const shouldSend = !!(
        invoice.user?.emailNotificationsEnabled &&
        invoice.user?.emailNotifyInvoiceOverdue
      );
      const daysOverdue = Math.max(
        0,
        Math.floor(
          (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      let description: string;
      if (shouldSend) {
        try {
          await this.emailService.sendPaymentReminderEmail(
            invoice as any,
            daysOverdue,
          );
          description = `Overdue reminder email sent to ${invoice.client.email}`;
        } catch (err) {
          this.logger.error(
            `Failed to send overdue reminder for invoice ${invoice.id}:`,
            err,
          );
          description = 'Overdue reminder email sending failed';
        }
      } else {
        description = 'Overdue reminder email skipped by user preferences';
      }

      // Record reminder history regardless of send/skip outcome
      try {
        await this.prisma.invoiceHistory.create({
          data: {
            invoiceId: invoice.id,
            action: HistoryAction.REMINDER_SENT,
            description,
            performedBy: null,
          },
        });
      } catch (e) {
        // Best-effort logging; do not throw
        this.logger.error(
          `Failed to create reminder history for invoice ${invoice.id}:`,
          e,
        );
      }

      // Emit notification event per invoice processed
      try {
        this.notifications.emit(invoice.userId, 'invoice.overdue', {
          id: invoice.id,
          daysOverdue,
          reminder: description,
        });
      } catch {}
    }
  }
}
