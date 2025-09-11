import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto, ProcessPaymentDto } from './dto/create-payment.dto';
import {
  PaymentStatus,
  InvoiceStatus,
  HistoryAction,
} from '../../common/enums';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, createPaymentDto: CreatePaymentDto) {
    // Verify invoice exists and belongs to user
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: createPaymentDto.invoiceId,
        userId,
      },
      include: {
        payments: true,
        client: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Calculate total paid amount
    const totalPaid = invoice.payments.reduce(
      (sum, payment) =>
        sum + (payment.status === PaymentStatus.COMPLETED ? payment.amount : 0),
      0,
    );

    const remainingAmount = invoice.totalAmount - totalPaid;

    if (createPaymentDto.amount > remainingAmount) {
      throw new BadRequestException('Payment amount exceeds invoice balance');
    }

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        ...createPaymentDto,
        status: PaymentStatus.COMPLETED,
        paymentDate: createPaymentDto.paymentDate || new Date(),
        paymentNumber: `PMT-${Date.now()}`,
        netAmount: createPaymentDto.amount,
      },
    });

    // Update invoice status if fully paid
    const newTotalPaid = totalPaid + createPaymentDto.amount;
    if (newTotalPaid >= invoice.totalAmount) {
      await this.prisma.invoice.update({
        where: { id: createPaymentDto.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: newTotalPaid,
          balanceDue: 0,
          paidAt: new Date(),
        },
      });

      // Create history entry
      await this.prisma.invoiceHistory.create({
        data: {
          invoiceId: createPaymentDto.invoiceId,
          action: HistoryAction.PAYMENT_RECEIVED,
          description: `Invoice fully paid`,
          performedBy: userId,
        },
      });
    } else {
      await this.prisma.invoice.update({
        where: { id: createPaymentDto.invoiceId },
        data: {
          status: InvoiceStatus.PARTIALLY_PAID,
          paidAmount: newTotalPaid,
          balanceDue: invoice.totalAmount - newTotalPaid,
        },
      });

      // Create history entry
      await this.prisma.invoiceHistory.create({
        data: {
          invoiceId: createPaymentDto.invoiceId,
          action: HistoryAction.PAYMENT_RECEIVED,
          description: `Partial payment of ${createPaymentDto.amount} received`,
          performedBy: userId,
        },
      });
    }

    // Send payment received email to the user if preferences allow
    if (
      invoice.user?.emailNotificationsEnabled &&
      invoice.user?.emailNotifyPaymentReceived
    ) {
      try {
        await this.emailService.sendPaymentReceivedEmail(
          invoice.user as any,
          invoice.client as any,
          invoice as any,
          createPaymentDto.amount,
        );
      } catch (err) {
        console.error('Failed to send payment received email (create):', err);
      }
    }

    // Send receipt email to the client (respect global emailNotificationsEnabled)
    if (invoice.user?.emailNotificationsEnabled) {
      try {
        const updatedPaidAmount = newTotalPaid;
        const updatedBalance = Math.max(
          0,
          (invoice.totalAmount || 0) - updatedPaidAmount,
        );
        await this.emailService.sendClientPaymentReceiptEmail(
          invoice.client as any,
          {
            ...invoice,
            paidAmount: updatedPaidAmount,
            balanceDue: updatedBalance,
          } as any,
          createPaymentDto.amount,
          invoice.user as any,
        );
      } catch (err) {
        console.error(
          'Failed to send client payment receipt email (create):',
          err,
        );
      }
    }

    try {
      this.notifications.emit(userId, 'payment.recorded', {
        invoiceId: createPaymentDto.invoiceId,
        amount: createPaymentDto.amount,
        paymentId: payment.id,
      });
    } catch (err) {
      void err;
    }
    return payment;
  }

  async processPayment(userId: string, processPaymentDto: ProcessPaymentDto) {
    // Verify invoice exists and belongs to user
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: processPaymentDto.invoiceId,
        userId,
      },
      include: {
        payments: true,
        client: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Mock payment processing
    // In a real application, this would integrate with payment gateways
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock success/failure (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;

    if (!isSuccess) {
      // Create failed payment record
      await this.prisma.payment.create({
        data: {
          invoiceId: processPaymentDto.invoiceId,
          amount: processPaymentDto.amount,
          paymentMethod: processPaymentDto.paymentMethod,
          paymentDate: new Date(),
          transactionId,
          status: PaymentStatus.FAILED,
          notes: 'Payment processing failed',
          paymentNumber: `PMT-${Date.now()}`,
          netAmount: 0,
        },
      });

      throw new BadRequestException(
        'Payment processing failed. Please try again.',
      );
    }

    // Create successful payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: processPaymentDto.invoiceId,
        amount: processPaymentDto.amount,
        paymentMethod: processPaymentDto.paymentMethod,
        paymentDate: new Date(),
        transactionId,
        status: PaymentStatus.COMPLETED,
        notes: processPaymentDto.notes,
        paymentNumber: `PMT-${Date.now()}`,
        netAmount: processPaymentDto.amount,
      },
    });

    // Calculate total paid amount
    const totalPaid =
      invoice.payments.reduce(
        (sum, p) => sum + (p.status === PaymentStatus.COMPLETED ? p.amount : 0),
        0,
      ) + processPaymentDto.amount;

    // Update invoice status
    if (totalPaid >= invoice.totalAmount) {
      await this.prisma.invoice.update({
        where: { id: processPaymentDto.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: totalPaid,
          balanceDue: 0,
          paidAt: new Date(),
        },
      });

      // Create history entry
      await this.prisma.invoiceHistory.create({
        data: {
          invoiceId: processPaymentDto.invoiceId,
          action: HistoryAction.PAYMENT_RECEIVED,
          description: `Invoice paid via ${processPaymentDto.paymentMethod}`,
          performedBy: userId,
        },
      });
    } else {
      await this.prisma.invoice.update({
        where: { id: processPaymentDto.invoiceId },
        data: {
          status: InvoiceStatus.PARTIALLY_PAID,
          paidAmount: totalPaid,
          balanceDue: invoice.totalAmount - totalPaid,
        },
      });

      // Create history entry
      await this.prisma.invoiceHistory.create({
        data: {
          invoiceId: processPaymentDto.invoiceId,
          action: HistoryAction.PAYMENT_RECEIVED,
          description: `Partial payment of ${processPaymentDto.amount} via ${processPaymentDto.paymentMethod}`,
          performedBy: userId,
        },
      });
    }

    // Send payment received email to the user if preferences allow
    if (
      invoice.user?.emailNotificationsEnabled &&
      invoice.user?.emailNotifyPaymentReceived
    ) {
      try {
        await this.emailService.sendPaymentReceivedEmail(
          invoice.user as any,
          invoice.client as any,
          invoice as any,
          processPaymentDto.amount,
        );
      } catch (err) {
        console.error(
          'Failed to send payment received email (processPayment):',
          err,
        );
      }
    }

    // Send receipt email to the client (respect global emailNotificationsEnabled)
    if (invoice.user?.emailNotificationsEnabled) {
      try {
        const updatedBalance = Math.max(
          0,
          (invoice.totalAmount || 0) - totalPaid,
        );
        await this.emailService.sendClientPaymentReceiptEmail(
          invoice.client as any,
          {
            ...invoice,
            paidAmount: totalPaid,
            balanceDue: updatedBalance,
          } as any,
          processPaymentDto.amount,
          invoice.user as any,
        );
      } catch (err) {
        console.error(
          'Failed to send client payment receipt email (processPayment):',
          err,
        );
      }
    }

    try {
      this.notifications.emit(userId, 'payment.processed', {
        invoiceId: processPaymentDto.invoiceId,
        amount: processPaymentDto.amount,
        paymentId: payment.id,
        transactionId,
      });
    } catch (err) {
      void err;
    }
    return {
      payment,
      message: 'Payment processed successfully',
      transactionId,
    };
  }

  async findAll(
    userId: string,
    query?: {
      invoiceId?: string;
      status?: PaymentStatus;
      method?: any;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: any = {};

    if (query?.invoiceId) {
      where.invoiceId = query.invoiceId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.method) {
      where.paymentMethod = query.method;
    }

    if (query?.dateFrom || query?.dateTo) {
      where.paymentDate = {};
      if (query.dateFrom) {
        const from = new Date(query.dateFrom);
        from.setHours(0, 0, 0, 0);
        where.paymentDate.gte = from;
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.paymentDate.lte = to;
      }
    }

    if (query?.search) {
      const s = String(query.search).trim();
      if (s.length > 0) {
        where.OR = [
          { transactionId: { contains: s, mode: 'insensitive' } },
          { paymentNumber: { contains: s, mode: 'insensitive' } },
          { notes: { contains: s, mode: 'insensitive' } },
          { invoice: { invoiceNumber: { contains: s, mode: 'insensitive' } } },
          {
            invoice: { client: { name: { contains: s, mode: 'insensitive' } } },
          },
        ];
      }
    }

    // Verify user owns the invoices
    where.invoice = { userId };

    const include = {
      invoice: {
        include: {
          client: true,
        },
      },
    } as const;

    const orderBy = { paymentDate: 'desc' } as const;

    if (query?.page && query?.limit) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
      const skip = (page - 1) * limit;
      const [total, items] = await Promise.all([
        this.prisma.payment.count({ where }),
        this.prisma.payment.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limit,
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return { items, total, totalPages, page, limit };
    }

    return this.prisma.payment.findMany({ where, include, orderBy });
  }

  async findOne(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify user owns the invoice
    if (payment.invoice.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async refund(id: string, userId: string, amount?: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify user owns the invoice
    if (payment.invoice.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    // Create refund payment record
    const refund = await this.prisma.payment.create({
      data: {
        invoiceId: payment.invoiceId,
        amount: -refundAmount,
        paymentMethod: payment.paymentMethod,
        paymentDate: new Date(),
        transactionId: `REFUND-${payment.transactionId}`,
        status: PaymentStatus.REFUNDED,
        notes: `Refund for payment ${payment.transactionId}`,
        paymentNumber: `PMT-${Date.now()}`,
        netAmount: -refundAmount,
      },
    });

    // Update original payment status if fully refunded
    if (refundAmount === payment.amount) {
      await this.prisma.payment.update({
        where: { id },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    // Update invoice paid amount
    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidAmount: {
          decrement: refundAmount,
        },
        status: InvoiceStatus.SENT, // Reset to SENT status after refund
        balanceDue: { increment: refundAmount },
      },
    });

    // Create history entry
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: payment.invoiceId,
        action: HistoryAction.STATUS_CHANGED,
        description: `Payment refunded: ${refundAmount}`,
        performedBy: userId,
      },
    });

    try {
      this.notifications.emit(userId, 'payment.refunded', {
        paymentId: id,
        invoiceId: payment.invoiceId,
        amount: refundAmount,
      });
    } catch (err) {
      void err;
    }
    return {
      refund,
      message: 'Payment refunded successfully',
    };
  }

  async getPaymentStatistics(userId: string) {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [totalReceived, monthlyReceived, pendingPayments, failedPayments] =
      await Promise.all([
        // Total received
        this.prisma.payment.aggregate({
          where: {
            invoice: { userId },
            status: PaymentStatus.COMPLETED,
            amount: { gt: 0 },
          },
          _sum: { amount: true },
        }),
        // This month received
        this.prisma.payment.aggregate({
          where: {
            invoice: { userId },
            status: PaymentStatus.COMPLETED,
            amount: { gt: 0 },
            paymentDate: { gte: currentMonth },
          },
          _sum: { amount: true },
        }),
        // Pending payments count
        this.prisma.payment.count({
          where: {
            invoice: { userId },
            status: PaymentStatus.PENDING,
          },
        }),
        // Failed payments count
        this.prisma.payment.count({
          where: {
            invoice: { userId },
            status: PaymentStatus.FAILED,
          },
        }),
      ]);

    return {
      totalReceived: totalReceived._sum.amount || 0,
      monthlyReceived: monthlyReceived._sum.amount || 0,
      pendingPayments,
      failedPayments,
    };
  }
}
