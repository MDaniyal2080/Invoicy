import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoiceStatus } from '@prisma/client';

// Simple helpers
const makeInvoice = (overrides: Partial<any> = {}) => ({
  id: 'inv_1',
  userId: 'user_1',
  client: { email: 'client@example.com' },
  items: [],
  user: {
    emailNotificationsEnabled: true,
    emailNotifyNewInvoice: true,
  },
  ...overrides,
});

describe('InvoicesService.sendInvoice', () => {
  let service: InvoicesService;
  let prisma: jest.Mocked<any>;
  let pdf: jest.Mocked<PdfService>;
  let email: jest.Mocked<EmailService>;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      invoiceHistory: {
        create: jest.fn(),
      },
    } as any;

    pdf = {
      generateInvoicePdf: jest.fn(),
    } as any;

    email = {
      sendInvoiceEmail: jest.fn(),
    } as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PdfService, useValue: pdf },
        { provide: EmailService, useValue: email },
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('sends email when preferences enabled', async () => {
    const invoice = makeInvoice();
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    pdf.generateInvoicePdf.mockResolvedValue(Buffer.from('PDF'));
    email.sendInvoiceEmail.mockResolvedValue(undefined);
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceHistory.create.mockResolvedValue({});

    const res = await service.sendInvoice('inv_1', 'user_1');

    expect(res).toEqual({ message: 'Invoice sent successfully' });
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'inv_1', userId: 'user_1' },
      include: { client: true, items: true, user: true },
    });
    expect(pdf.generateInvoicePdf).toHaveBeenCalled();
    expect(email.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvoiceStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceId: 'inv_1',
        action: expect.any(String),
        description: expect.stringContaining('Invoice sent to'),
        performedBy: 'user_1',
      }),
    });
  });

  it('skips email when preferences disabled', async () => {
    const invoice = makeInvoice({
      user: { emailNotificationsEnabled: false, emailNotifyNewInvoice: true },
    });
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceHistory.create.mockResolvedValue({});

    const res = await service.sendInvoice('inv_1', 'user_1');

    expect(res).toEqual({ message: 'Invoice sent successfully' });
    expect(pdf.generateInvoicePdf).not.toHaveBeenCalled();
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvoiceStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('skipped by user preferences'),
      }),
    });
  });

  it('skips email when emailNotifyNewInvoice disabled', async () => {
    const invoice = makeInvoice({
      user: { emailNotificationsEnabled: true, emailNotifyNewInvoice: false },
    });
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceHistory.create.mockResolvedValue({});

    const res = await service.sendInvoice('inv_1', 'user_1');

    expect(res).toEqual({ message: 'Invoice sent successfully' });
    expect(pdf.generateInvoicePdf).not.toHaveBeenCalled();
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvoiceStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('skipped by user preferences'),
      }),
    });
  });

  it('skips email when both preferences disabled', async () => {
    const invoice = makeInvoice({
      user: { emailNotificationsEnabled: false, emailNotifyNewInvoice: false },
    });
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceHistory.create.mockResolvedValue({});

    const res = await service.sendInvoice('inv_1', 'user_1');

    expect(res).toEqual({ message: 'Invoice sent successfully' });
    expect(pdf.generateInvoicePdf).not.toHaveBeenCalled();
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvoiceStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('skipped by user preferences'),
      }),
    });
  });

  it('handles email failure gracefully', async () => {
    const invoice = makeInvoice();
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    pdf.generateInvoicePdf.mockResolvedValue(Buffer.from('PDF'));
    email.sendInvoiceEmail.mockRejectedValue(new Error('SMTP failure'));
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceHistory.create.mockResolvedValue({});

    const res = await service.sendInvoice('inv_1', 'user_1');

    expect(res).toEqual({ message: 'Invoice sent successfully' });
    expect(pdf.generateInvoicePdf).toHaveBeenCalled();
    expect(email.sendInvoiceEmail).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvoiceStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('email sending failed'),
      }),
    });
  });

  it('throws NotFoundException when invoice not found', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.sendInvoice('missing', 'user_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pdf.generateInvoicePdf).not.toHaveBeenCalled();
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.invoiceHistory.create).not.toHaveBeenCalled();
  });
});
