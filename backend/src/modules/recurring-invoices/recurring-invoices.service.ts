import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import {
  DiscountType,
  HistoryAction,
  InvoiceStatus,
  Plan,
  RecurrenceFrequency,
  RecurringStatus,
} from '../../common/enums';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class RecurringInvoicesService {
  private readonly logger = new Logger(RecurringInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async create(userId: string, dto: CreateRecurringInvoiceDto) {
    // Validate items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    const created = await this.prisma.recurringInvoice.create({
      data: {
        userId,
        clientId: dto.clientId,
        taxRate: dto.taxRate ?? 0,
        discount: dto.discount ?? 0,
        discountType: dto.discountType ?? DiscountType.FIXED,
        currency: dto.currency ?? 'USD',
        notes: dto.notes,
        terms: dto.terms,
        footer: dto.footer,
        dueInDays: dto.dueInDays ?? null,
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        startDate,
        endDate: dto.endDate ?? null,
        nextRunAt: startDate,
        maxOccurrences: dto.maxOccurrences ?? null,
        status: RecurringStatus.ACTIVE,
        autoSend: dto.autoSend ?? false,
        items: {
          create: dto.items.map((it, idx) => ({
            description: it.description,
            quantity: it.quantity,
            rate: it.rate,
            unit: it.unit ?? 'unit',
            taxable: it.taxable ?? true,
            amount: it.quantity * it.rate,
            order: idx,
          })),
        },
      },
      include: { items: true },
    });

    return created;
  }

  async findAll(
    userId: string,
    query?: {
      status?: RecurringStatus;
      clientId?: string;
      search?: string; // by client name
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const where: any = { userId };
      if (query?.status) {
        if (!Object.values(RecurringStatus).includes(query.status)) {
          throw new BadRequestException('Invalid status');
        }
        where.status = query.status;
      }
      if (query?.clientId) where.clientId = query.clientId;
      if (query?.search) {
        where.OR = [
          {
            client: {
              is: { name: { contains: query.search, mode: 'insensitive' } },
            },
          },
          { notes: { contains: query.search, mode: 'insensitive' } },
          { terms: { contains: query.search, mode: 'insensitive' } },
          { footer: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const rawPage = Number(query?.page);
      const rawLimit = Number(query?.limit);
      const page =
        Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 10;

      const [total, items] = await Promise.all([
        this.prisma.recurringInvoice.count({ where }),
        this.prisma.recurringInvoice.findMany({
          where,
          include: { client: true, items: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (e) {
      this.logger.error('Failed to fetch recurring invoices', e);
      throw e instanceof BadRequestException
        ? e
        : new BadRequestException('Failed to fetch recurring invoices');
    }
  }

  async findOne(id: string, userId: string) {
    const rec = await this.prisma.recurringInvoice.findFirst({
      where: { id, userId },
      include: { client: true, items: true },
    });
    if (!rec) throw new NotFoundException('Recurring invoice not found');
    return rec;
  }

  async update(id: string, userId: string, dto: UpdateRecurringInvoiceDto) {
    const exists = await this.prisma.recurringInvoice.findFirst({
      where: { id, userId },
    });
    if (!exists) throw new NotFoundException('Recurring invoice not found');

    const data: any = { ...dto };
    // Normalize fields not in schema
    if ('items' in data) delete data.items;

    const updated = await this.prisma.recurringInvoice.update({
      where: { id },
      data,
      include: { client: true, items: true },
    });

    // Replace items if provided
    if ((dto as any).items) {
      await this.prisma.recurringInvoiceItem.deleteMany({
        where: { recurringInvoiceId: id },
      });
      await this.prisma.recurringInvoiceItem.createMany({
        data: (dto as any).items.map((it: any, idx: number) => ({
          recurringInvoiceId: id,
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          unit: it.unit ?? 'unit',
          taxable: it.taxable ?? true,
          amount: it.quantity * it.rate,
          order: idx,
        })),
      });
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const exists = await this.prisma.recurringInvoice.findFirst({
      where: { id, userId },
    });
    if (!exists) throw new NotFoundException('Recurring invoice not found');
    await this.prisma.recurringInvoice.delete({ where: { id } });
    return { message: 'Recurring invoice deleted successfully' };
  }

  async pause(id: string, userId: string) {
    return this.setStatus(id, userId, RecurringStatus.PAUSED);
  }

  async resume(id: string, userId: string) {
    return this.setStatus(id, userId, RecurringStatus.ACTIVE);
  }

  async cancel(id: string, userId: string) {
    return this.setStatus(id, userId, RecurringStatus.CANCELLED);
  }

  private async setStatus(id: string, userId: string, status: RecurringStatus) {
    const rec = await this.prisma.recurringInvoice.findFirst({
      where: { id, userId },
    });
    if (!rec) throw new NotFoundException('Recurring invoice not found');
    const updated = await this.prisma.recurringInvoice.update({
      where: { id },
      data: { status },
    });
    return updated;
  }

  async runNow(id: string, userId: string) {
    const rec = await this.prisma.recurringInvoice.findFirst({
      where: { id, userId },
      include: { items: true, user: true, client: true },
    });
    if (!rec) throw new NotFoundException('Recurring invoice not found');
    if (rec.status !== RecurringStatus.ACTIVE) {
      throw new BadRequestException('Recurring invoice is not active');
    }
    const now = new Date();
    // If endDate is set and passed, do not run
    if (rec.endDate && now > rec.endDate) {
      throw new BadRequestException('End date reached');
    }
    return this.generateFor(rec.id);
  }

  async processDue(now = new Date()) {
    // Find due recurring invoices
    const due = await this.prisma.recurringInvoice.findMany({
      where: {
        status: RecurringStatus.ACTIVE,
        nextRunAt: { lte: now },
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      include: { items: true, user: true, client: true },
      orderBy: { nextRunAt: 'asc' },
    });

    for (const rec of due) {
      try {
        await this.generateFor(rec.id);
      } catch (e) {
        this.logger.error(`Failed processing recurring invoice ${rec.id}`, e);
      }
    }

    return { processed: due.length };
  }

  private computeNextRun(
    currentNext: Date,
    frequency: RecurrenceFrequency,
    interval: number,
  ): Date {
    const next = new Date(currentNext);
    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        next.setDate(next.getDate() + interval);
        break;
      case RecurrenceFrequency.WEEKLY:
        next.setDate(next.getDate() + 7 * interval);
        break;
      case RecurrenceFrequency.MONTHLY: {
        const originalDay = next.getDate();
        // Move to first day of target month to avoid overflow issues
        next.setDate(1);
        next.setMonth(next.getMonth() + interval);
        // Clamp to last day of target month if original day exceeds it
        const lastDayOfTargetMonth = new Date(
          next.getFullYear(),
          next.getMonth() + 1,
          0,
        ).getDate();
        next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
        break;
      }
      case RecurrenceFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        next.setDate(next.getDate() + interval);
    }
    return next;
  }

  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  async generateFor(recurringId: string) {
    const now = new Date();

    // Use a transaction to guard against race conditions and enforce plan limits and numbering
    const result = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.recurringInvoice.findUnique({
        where: { id: recurringId },
        include: { items: true, user: true, client: true },
      });
      if (!rec) throw new NotFoundException('Recurring invoice not found');
      if (rec.status !== RecurringStatus.ACTIVE)
        throw new BadRequestException('Recurring invoice is not active');
      if (rec.endDate && now > rec.endDate)
        throw new BadRequestException('End date reached');
      if (rec.maxOccurrences && rec.occurrencesCount >= rec.maxOccurrences) {
        throw new BadRequestException('Max occurrences reached');
      }
      if (rec.nextRunAt > now) {
        throw new BadRequestException('Not due yet');
      }

      // Enforce plan invoice limits before creating
      const user = await tx.user.findUnique({
        where: { id: rec.userId },
        select: {
          subscriptionPlan: true,
          invoiceLimit: true,
          paymentTerms: true,
          invoicePrefix: true,
          invoiceStartNumber: true,
        },
      });

      if (user && user.subscriptionPlan !== Plan.ENTERPRISE) {
        if (typeof user.invoiceLimit === 'number' && user.invoiceLimit > 0) {
          const currentCount = await tx.invoice.count({
            where: {
              userId: rec.userId,
              status: { not: InvoiceStatus.CANCELLED },
            },
          });
          if (currentCount >= user.invoiceLimit) {
            throw new BadRequestException(
              'Invoice limit reached for your plan',
            );
          }
        }
      }

      // Compute amounts
      let subtotal = 0;
      const items = rec.items.map((it) => {
        const amount = it.quantity * it.rate;
        subtotal += amount;
        return {
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          amount,
        };
      });
      const taxAmount = rec.taxRate ? (subtotal * rec.taxRate) / 100 : 0;
      const discountAmount = rec.discount
        ? rec.discountType === DiscountType.PERCENTAGE
          ? (subtotal * rec.discount) / 100
          : rec.discount
        : 0;
      const totalAmount = subtotal + taxAmount - discountAmount;

      // Compute dates
      const invoiceDate = now;
      const dueDays = rec.dueInDays ?? user?.paymentTerms ?? 30;
      const dueDate = this.addDays(invoiceDate, dueDays);

      // Atomically increment and compute invoice number
      const updatedUser = await tx.user.update({
        where: { id: rec.userId },
        data: { invoiceStartNumber: { increment: 1 } },
        select: { invoicePrefix: true, invoiceStartNumber: true },
      });
      const usedNumber = (updatedUser.invoiceStartNumber || 1) - 1;
      const invoiceNumber = `${updatedUser.invoicePrefix || 'INV'}-${String(usedNumber).padStart(5, '0')}`;

      const createdInvoice = await tx.invoice.create({
        data: {
          userId: rec.userId,
          clientId: rec.clientId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          status: InvoiceStatus.DRAFT,
          subtotal,
          taxRate: rec.taxRate || 0,
          taxAmount,
          discount: rec.discount || 0,
          discountType: rec.discountType || DiscountType.FIXED,
          totalAmount,
          balanceDue: totalAmount,
          currency: rec.currency || 'USD',
          notes: rec.notes ?? undefined,
          terms: rec.terms ?? undefined,
          footer: rec.footer ?? undefined,
          items: { create: items },
        },
        include: { client: true, items: true },
      });

      await tx.invoiceHistory.create({
        data: {
          invoiceId: createdInvoice.id,
          action: HistoryAction.CREATED,
          description: `Invoice ${createdInvoice.invoiceNumber} created from recurring template ${rec.id}`,
          performedBy: null,
        },
      });

      // Advance schedule
      const next = this.computeNextRun(
        rec.nextRunAt,
        rec.frequency,
        rec.interval || 1,
      );
      const occurrencesCount = (rec.occurrencesCount ?? 0) + 1;

      // Determine new status after increment
      let newStatus: RecurringStatus = RecurringStatus.ACTIVE;
      const nextRunAt = next;
      if (
        (rec.maxOccurrences && occurrencesCount >= rec.maxOccurrences) ||
        (rec.endDate && next > rec.endDate)
      ) {
        newStatus = RecurringStatus.CANCELLED;
        // Keep nextRunAt as computed but status prevents future runs
      }

      await tx.recurringInvoice.update({
        where: { id: rec.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          occurrencesCount,
          status: newStatus,
        },
      });

      return { createdInvoice, template: rec };
    });

    // Auto-send if enabled
    try {
      if (result.template.autoSend) {
        await this.invoicesService.sendInvoice(
          result.createdInvoice.id,
          result.createdInvoice.userId,
        );
      }
    } catch (e) {
      this.logger.error(
        `Auto-send failed for invoice ${result.createdInvoice.id}`,
        e,
      );
      // continue without throwing
    }

    return result.createdInvoice;
  }
}
