import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PdfService } from './pdf.service';
import { InvoiceStatus, HistoryAction, Plan } from '../../common/enums';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private emailService: EmailService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, createInvoiceDto: CreateInvoiceDto) {
    // Calculate amounts and sanitize items first
    let subtotal = 0;
    const items = createInvoiceDto.items.map((item) => {
      const amount = item.quantity * item.rate;
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount,
      };
    });

    const taxAmount = createInvoiceDto.taxRate
      ? (subtotal * createInvoiceDto.taxRate) / 100
      : 0;
    const discountAmount = createInvoiceDto.discount
      ? createInvoiceDto.discountType === 'PERCENTAGE'
        ? (subtotal * createInvoiceDto.discount) / 100
        : createInvoiceDto.discount
      : 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice = await this.prisma.$transaction(async (tx) => {
      // Enforce plan invoice limits before creating
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true, invoiceLimit: true },
      });

      if (user && user.subscriptionPlan !== Plan.ENTERPRISE) {
        // Determine effective limit from DB value or plan defaults
        let effectiveLimit = Number.isFinite(user.invoiceLimit as any)
          ? Number(user.invoiceLimit)
          : NaN;
        if (!Number.isFinite(effectiveLimit) || effectiveLimit <= 0) {
          effectiveLimit =
            user.subscriptionPlan === Plan.FREE
              ? 5
              : user.subscriptionPlan === Plan.BASIC
              ? 50
              : 0; // PREMIUM and higher: 0 means unlimited
        }
        if (effectiveLimit > 0) {
          const currentCount = await tx.invoice.count({
            where: { userId, status: { not: InvoiceStatus.CANCELLED } },
          });
          if (currentCount >= effectiveLimit) {
            throw new BadRequestException(
              'Invoice limit reached for your plan',
            );
          }
        }
      }

      // Determine invoice number: if provided, use it; else atomically increment start number
      let invoiceNumber = createInvoiceDto.invoiceNumber;
      if (!invoiceNumber) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { invoiceStartNumber: { increment: 1 } },
          select: { invoicePrefix: true, invoiceStartNumber: true },
        });
        const usedNumber = (updatedUser.invoiceStartNumber || 1) - 1;
        invoiceNumber = `${updatedUser.invoicePrefix || 'INV'}-${String(usedNumber).padStart(5, '0')}`;
      }

      const created = await tx.invoice.create({
        data: {
          userId,
          clientId: createInvoiceDto.clientId,
          invoiceNumber,
          invoiceDate: createInvoiceDto.invoiceDate || new Date(),
          dueDate: createInvoiceDto.dueDate,
          status: createInvoiceDto.status || InvoiceStatus.DRAFT,
          subtotal,
          taxRate: createInvoiceDto.taxRate || 0,
          taxAmount,
          discount: createInvoiceDto.discount || 0,
          discountType: createInvoiceDto.discountType || 'FIXED',
          totalAmount,
          balanceDue: totalAmount,
          currency: createInvoiceDto.currency || 'USD',
          notes: createInvoiceDto.notes,
          terms: createInvoiceDto.terms,
          footer: createInvoiceDto.footer,
          items: { create: items },
        },
        include: { client: true, items: true },
      });

      await tx.invoiceHistory.create({
        data: {
          invoiceId: created.id,
          action: HistoryAction.CREATED,
          description: `Invoice ${created.invoiceNumber} created`,
          performedBy: userId,
        },
      });

      return created;
    });

    // Emit event
    try {
      this.notifications.emit(userId, 'invoice.created', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
    } catch {}
    return invoice;
  }

  async findAll(
    userId: string,
    query?: {
      status?: (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
      clientId?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    },
  ) {
    const where: any = { userId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.clientId) {
      where.clientId = query.clientId;
    }

    if (query?.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { client: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query?.startDate && query?.endDate) {
      where.invoiceDate = {
        gte: query.startDate,
        lte: query.endDate,
      };
    }

    const rawPage = Number(query?.page);
    const rawLimit = Number(query?.limit);
    const page =
      Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(100, Math.floor(rawLimit))
        : 10;

    // Sorting
    const allowedSort: Record<string, string> = {
      createdAt: 'createdAt',
      invoiceDate: 'invoiceDate',
      dueDate: 'dueDate',
      totalAmount: 'totalAmount',
      status: 'status',
    };
    const sortBy =
      query?.sortBy && allowedSort[query.sortBy]
        ? allowedSort[query.sortBy]
        : 'createdAt';
    const sortDir: 'asc' | 'desc' =
      query?.sortDir === 'asc' || query?.sortDir === 'desc'
        ? query.sortDir
        : 'desc';

    const [total, itemsRaw] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          client: true,
          payments: true,
          history: {
            where: { action: HistoryAction.CREATED },
            select: { description: true },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { [sortBy]: sortDir } as any,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = itemsRaw.map((inv: any) => {
      const createdDesc: string | undefined = inv?.history?.[0]?.description;
      const generatedFromRecurring = !!(
        createdDesc && createdDesc.includes('created from recurring template')
      );
      return { ...inv, generatedFromRecurring };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string) {
    const invoiceRaw = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        items: true,
        payments: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoiceRaw) {
      throw new NotFoundException('Invoice not found');
    }

    const createdEntry = invoiceRaw.history?.find(
      (h) =>
        typeof (h as any).description === 'string' &&
        (h as any).description.includes('created from recurring template'),
    );
    const generatedFromRecurring = !!createdEntry;
    return { ...invoiceRaw, generatedFromRecurring } as any;
  }

  async update(id: string, userId: string, updateInvoiceDto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Recalculate amounts if items are updated
    let updateData: any = { ...updateInvoiceDto };
    // Remove fields that do not exist in Prisma schema
    if ('recurring' in updateData) delete updateData.recurring;
    if ('recurringInterval' in updateData) delete updateData.recurringInterval;

    if ((updateInvoiceDto as any).items) {
      let subtotal = 0;
      const items = (updateInvoiceDto as any).items.map((item: any) => {
        const amount = item.quantity * item.rate;
        subtotal += amount;

        return {
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount,
        };
      });

      const taxAmount = (updateInvoiceDto as any).taxRate
        ? (subtotal * (updateInvoiceDto as any).taxRate) / 100
        : 0;

      const discountAmount = (updateInvoiceDto as any).discount
        ? (updateInvoiceDto as any).discountType === 'PERCENTAGE'
          ? (subtotal * (updateInvoiceDto as any).discount) / 100
          : (updateInvoiceDto as any).discount
        : 0;

      const totalAmount = subtotal + taxAmount - discountAmount;

      updateData = {
        ...updateData,
        subtotal,
        taxAmount,
        totalAmount,
        balanceDue: totalAmount - invoice.paidAmount,
      };

      // Delete existing items and create new ones
      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      await this.prisma.invoiceItem.createMany({
        data: items.map((item) => ({ ...item, invoiceId: id })),
      });

      delete updateData.items;
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        items: true,
      },
    });

    // Create history entry
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: id,
        action: HistoryAction.UPDATED,
        description: 'Invoice updated',
        performedBy: userId,
      },
    });

    try {
      this.notifications.emit(userId, 'invoice.updated', {
        id,
        invoiceNumber: updatedInvoice.invoiceNumber,
      });
    } catch {}
    return updatedInvoice;
  }

  async cancelInvoice(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      return invoice;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: id,
        action: HistoryAction.CANCELLED,
        description: 'Invoice cancelled',
        performedBy: userId,
      },
    });

    try {
      this.notifications.emit(userId, 'invoice.cancelled', { id });
    } catch {}
    return updated;
  }

  async updateShare(
    id: string,
    userId: string,
    opts: { enable?: boolean; regenerate?: boolean },
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const data: any = {};
    if (typeof opts.enable === 'boolean') data.shareEnabled = opts.enable;
    if (opts.regenerate) data.shareId = randomUUID();
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: data,
      select: { id: true, shareId: true, shareEnabled: true },
    });
    try {
      this.notifications.emit(userId, 'invoice.share_updated', {
        id,
        shareId: updated.shareId,
        shareEnabled: updated.shareEnabled,
      });
    } catch {}
    return updated;
  }

  async remove(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check if invoice has payments
    const paymentCount = await this.prisma.payment.count({
      where: { invoiceId: id },
    });

    if (paymentCount > 0) {
      throw new BadRequestException('Cannot delete invoice with payments');
    }

    await this.prisma.invoice.delete({
      where: { id },
    });

    return { message: 'Invoice deleted successfully' };
  }

  async updateStatus(
    id: string,
    userId: string,
    status: (typeof InvoiceStatus)[keyof typeof InvoiceStatus],
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const data: any = { status };
    if (status === InvoiceStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }
    if (status === InvoiceStatus.PAID) {
      data.paidAt = new Date();
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data,
    });

    // Create history entry
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: id,
        action: HistoryAction.STATUS_CHANGED,
        description: `Status changed to ${status}`,
        performedBy: userId,
      },
    });

    try {
      this.notifications.emit(userId, 'invoice.status_changed', { id, status });
    } catch {}
    return updatedInvoice;
  }

  async sendInvoice(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Manual send endpoint: Always attempt to send regardless of user notification preferences.
    // Preferences should govern automated emails, not explicit manual "send" actions.
    let emailSent = false;
    let emailSkipOrFailDescription: string | undefined;
    try {
      // Ensure public share link is enabled so the client can view & pay
      let invForEmail = invoice;
      if (!invoice.shareEnabled || !invoice.shareId) {
        invForEmail = await this.prisma.invoice.update({
          where: { id },
          data: {
            shareEnabled: true,
            shareId: invoice.shareId || randomUUID(),
          },
          include: { client: true, items: true, user: true },
        });
      }

      // Basic validation to avoid provider errors
      if (!invForEmail?.client?.email) {
        throw new BadRequestException('Client email address is missing');
      }

      const pdfBuffer = await this.pdfService.generateInvoicePdf(invForEmail);
      await this.emailService.sendInvoiceEmail(invForEmail as any, pdfBuffer);
      emailSent = true;
    } catch (err) {
      // Log and continue without failing the request
      console.error('Failed to send invoice email:', err);
      emailSkipOrFailDescription =
        err?.message === 'Client email address is missing'
          ? 'Invoice marked as SENT (client email missing)'
          : 'Invoice marked as SENT (email sending failed)';
    }

    // Update status to SENT
    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
      },
    });

    // Create history entry
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId: id,
        action: HistoryAction.SENT,
        description: emailSent
          ? `Invoice sent to ${invoice.client.email}`
          : (emailSkipOrFailDescription as string),
        performedBy: userId,
      },
    });

    try {
      this.notifications.emit(userId, 'invoice.sent', {
        id,
        emailSent: !!emailSent,
      });
    } catch {}
    return { message: 'Invoice sent successfully' };
  }

  async sendInvoicesBulk(ids: string[], userId: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids array is required');
    }

    // Fetch all invoices belonging to user
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: ids }, userId },
      include: { client: true, items: true, user: true },
    });

    const foundIds = new Set(invoices.map((i) => i.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));

    const results: Array<{
      id: string;
      status: 'sent' | 'skipped' | 'failed' | 'not_found';
      message?: string;
    }> = [];

    for (const id of ids) {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) {
        results.push({
          id,
          status: 'not_found',
          message: 'Invoice not found or not owned by user',
        });
        continue;
      }

      try {
        if (!inv?.client?.email) {
          throw new BadRequestException('Client email address is missing');
        }
        const pdfBuffer = await this.pdfService.generateInvoicePdf(inv as any);
        await this.emailService.sendInvoiceEmail(inv as any, pdfBuffer);
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { status: InvoiceStatus.SENT, sentAt: new Date() },
        });
        await this.prisma.invoiceHistory.create({
          data: {
            invoiceId: inv.id,
            action: HistoryAction.SENT,
            description: `Invoice sent to ${inv.client.email}`,
            performedBy: userId,
          },
        });
        results.push({ id: inv.id, status: 'sent' });
      } catch (e: any) {
        // Log and continue
        console.error('Failed to send invoice email (bulk):', e);
        try {
          await this.prisma.invoice.update({
            where: { id: inv.id },
            data: { status: InvoiceStatus.SENT, sentAt: new Date() },
          });
          await this.prisma.invoiceHistory.create({
            data: {
              invoiceId: inv.id,
              action: HistoryAction.SENT,
              description:
                e?.message === 'Client email address is missing'
                  ? 'Invoice marked as SENT (client email missing)'
                  : 'Invoice marked as SENT (email sending failed in bulk)',
              performedBy: userId,
            },
          });
        } catch {}
        results.push({
          id: inv.id,
          status: 'failed',
          message: e?.message || 'Email sending failed',
        });
      }
    }

    const summary = {
      totalRequested: ids.length,
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
    } as const;

    return { summary, results };
  }

  async updateStatusBulk(
    ids: string[],
    userId: string,
    status: (typeof InvoiceStatus)[keyof typeof InvoiceStatus],
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids array is required');
    }
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: ids }, userId },
    });
    const foundIds = invoices.map((i) => i.id);
    if (foundIds.length === 0) {
      return {
        summary: {
          totalRequested: ids.length,
          updated: 0,
          notFound: ids.length,
        },
      };
    }

    const data: any = { status };
    if (status === InvoiceStatus.CANCELLED) data.cancelledAt = new Date();
    if (status === InvoiceStatus.PAID) data.paidAt = new Date();

    await this.prisma.invoice.updateMany({
      where: { id: { in: foundIds } },
      data,
    });

    // Write history entries
    try {
      await this.prisma.invoiceHistory.createMany({
        data: foundIds.map((id) => ({
          invoiceId: id,
          action: HistoryAction.STATUS_CHANGED,
          description: `Status changed to ${status} (bulk)`,
          performedBy: userId,
        })),
      });
    } catch {}

    // Emit events
    try {
      for (const id of foundIds) {
        this.notifications.emit(userId, 'invoice.status_changed', {
          id,
          status,
        });
      }
    } catch {}

    return {
      summary: {
        totalRequested: ids.length,
        updated: foundIds.length,
        notFound: ids.length - foundIds.length,
      },
    };
  }

  async markPaidBulk(ids: string[], userId: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids array is required');
    }
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: ids }, userId },
    });
    const foundIds = invoices.map((i) => i.id);
    if (foundIds.length === 0) {
      return {
        summary: {
          totalRequested: ids.length,
          updated: 0,
          notFound: ids.length,
        },
      };
    }

    const now = new Date();
    await this.prisma.$transaction([
      ...invoices.map((inv) =>
        this.prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: now,
            paidAmount: inv.totalAmount,
            balanceDue: 0,
          },
        }),
      ),
      this.prisma.invoiceHistory.createMany({
        data: foundIds.map((id) => ({
          invoiceId: id,
          action: HistoryAction.PAYMENT_RECEIVED,
          description: 'Marked as paid (bulk)',
          performedBy: userId,
        })),
      }),
    ]);

    // Emit events
    try {
      for (const id of foundIds) {
        this.notifications.emit(userId, 'invoice.status_changed', {
          id,
          status: InvoiceStatus.PAID,
        });
      }
    } catch {}

    return {
      summary: {
        totalRequested: ids.length,
        updated: foundIds.length,
        notFound: ids.length - foundIds.length,
      },
    };
  }

  async removeBulk(ids: string[], userId: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids array is required');
    }
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    });
    const foundIds = invoices.map((i) => i.id);
    if (foundIds.length === 0) {
      return {
        summary: {
          totalRequested: ids.length,
          deleted: 0,
          skipped: 0,
          notFound: ids.length,
        },
      };
    }

    const deletable: string[] = [];
    for (const id of foundIds) {
      const count = await this.prisma.payment.count({
        where: { invoiceId: id },
      });
      if (count === 0) deletable.push(id);
    }

    if (deletable.length > 0) {
      await this.prisma.invoice.deleteMany({
        where: { id: { in: deletable }, userId },
      });
    }

    // Emit events
    try {
      for (const id of deletable) {
        this.notifications.emit(userId, 'invoice.deleted', { id });
      }
    } catch {}

    return {
      summary: {
        totalRequested: ids.length,
        deleted: deletable.length,
        skipped: foundIds.length - deletable.length,
        notFound: ids.length - foundIds.length,
      },
    };
  }

  async downloadPdf(
    id: string,
    userId: string,
    options?: {
      template?: string;
      colorScheme?: string;
      font?: string;
      layout?: string;
      footer?: string;
    },
  ): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        items: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Create history entry (non-blocking). If enum value is missing in DB, don't fail the request.
    try {
      await this.prisma.invoiceHistory.create({
        data: {
          invoiceId: id,
          action: HistoryAction.EXPORTED,
          description: 'Invoice PDF downloaded',
          performedBy: userId,
        },
      });
    } catch (e: any) {
      console.error(
        'Failed to write invoice history (EXPORTED):',
        e?.message || e,
      );
    }

    const mergedOptions = {
      ...(options || {}),
      footer:
        options?.footer ??
        invoice.footer ??
        (invoice as any)?.user?.invoiceFooter,
    };

    return this.pdfService.generateInvoicePdf(invoice, mergedOptions as any);
  }

  async duplicateInvoice(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, userId },
        include: { items: true },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Enforce plan invoice limits before duplicating
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true, invoiceLimit: true },
      });

      if (user && user.subscriptionPlan !== Plan.ENTERPRISE) {
        let effectiveLimit = Number.isFinite(user.invoiceLimit as any)
          ? Number(user.invoiceLimit)
          : NaN;
        if (!Number.isFinite(effectiveLimit) || effectiveLimit <= 0) {
          effectiveLimit =
            user.subscriptionPlan === Plan.FREE
              ? 5
              : user.subscriptionPlan === Plan.BASIC
              ? 50
              : 0;
        }
        if (effectiveLimit > 0) {
          const currentCount = await tx.invoice.count({
            where: { userId, status: { not: InvoiceStatus.CANCELLED } },
          });
          if (currentCount >= effectiveLimit) {
            throw new BadRequestException(
              'Invoice limit reached for your plan',
            );
          }
        }
      }

      // Atomically increment and use previous number
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { invoiceStartNumber: { increment: 1 } },
        select: { invoicePrefix: true, invoiceStartNumber: true },
      });
      const usedNumber = (updatedUser.invoiceStartNumber || 1) - 1;
      const invoiceNumber = `${updatedUser.invoicePrefix || 'INV'}-${String(usedNumber).padStart(5, '0')}`;

      const duplicate = await tx.invoice.create({
        data: {
          userId,
          clientId: invoice.clientId,
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate: new Date(
            Date.now() +
              (invoice.dueDate.getTime() - invoice.invoiceDate.getTime()),
          ),
          status: InvoiceStatus.DRAFT,
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          discount: invoice.discount,
          discountType: invoice.discountType,
          totalAmount: invoice.totalAmount,
          balanceDue: invoice.totalAmount - invoice.paidAmount,
          currency: invoice.currency,
          notes: invoice.notes,
          terms: invoice.terms,
          footer: invoice.footer,
          items: {
            create: invoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
            })),
          },
        },
        include: { client: true, items: true },
      });

      await tx.invoiceHistory.create({
        data: {
          invoiceId: duplicate.id,
          action: HistoryAction.CREATED,
          description: `Invoice duplicated from ${invoice.invoiceNumber}`,
          performedBy: userId,
        },
      });
      try {
        this.notifications.emit(userId, 'invoice.duplicated', {
          id: duplicate.id,
          from: invoice.id,
        });
      } catch {}
      return duplicate;
    });
  }

  async getStatistics(userId: string) {
    const [total, paid, overdue, draft] = await Promise.all([
      this.prisma.invoice.count({ where: { userId } }),
      this.prisma.invoice.count({
        where: { userId, status: InvoiceStatus.PAID },
      }),
      this.prisma.invoice.count({
        where: {
          userId,
          status: InvoiceStatus.OVERDUE,
        },
      }),
      this.prisma.invoice.count({
        where: { userId, status: InvoiceStatus.DRAFT },
      }),
    ]);

    const totalRevenue = await this.prisma.invoice.aggregate({
      where: { userId, status: InvoiceStatus.PAID },
      _sum: { totalAmount: true },
    });

    const pendingAmount = await this.prisma.invoice.aggregate({
      where: {
        userId,
        status: {
          in: [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.OVERDUE],
        },
      },
      _sum: { totalAmount: true },
    });

    return {
      total,
      paid,
      overdue,
      draft,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      pendingAmount: pendingAmount._sum.totalAmount || 0,
    };
  }

  async getPublicInvoiceByShareId(
    shareId: string,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { shareId, shareEnabled: true },
      include: {
        client: true,
        items: true,
        payments: true,
        user: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only mark viewed if not cancelled/paid
    const shouldMarkViewed =
      invoice.status !== InvoiceStatus.CANCELLED &&
      invoice.status !== InvoiceStatus.PAID;

    if (shouldMarkViewed) {
      const newStatus =
        invoice.status === InvoiceStatus.SENT ||
        invoice.status === InvoiceStatus.DRAFT
          ? InvoiceStatus.VIEWED
          : invoice.status;

      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            viewedAt: new Date(),
            status: newStatus,
          },
        });

        await tx.invoiceHistory.create({
          data: {
            invoiceId: invoice.id,
            action: HistoryAction.VIEWED,
            description: 'Invoice viewed via share link',
            metadata: metadata ? (metadata as any) : undefined,
            performedBy: null,
          },
        });
      });

      // Return the fresh copy after updates
      const updated = await this.prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          client: true,
          items: true,
          payments: true,
          user: true,
          history: { orderBy: { createdAt: 'desc' } },
        },
      });
      try {
        this.notifications.emit(invoice.userId, 'invoice.viewed', {
          id: invoice.id,
        });
      } catch {}
      return updated!;
    }

    return invoice;
  }
}
