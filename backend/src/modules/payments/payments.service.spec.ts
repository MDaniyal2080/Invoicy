import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PaymentStatus, InvoiceStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

// Helpers
const makeInvoice = (overrides: Partial<any> = {}) => ({
  id: 'inv_1',
  userId: 'user_1',
  totalAmount: 100,
  payments: [],
  client: { name: 'Client A', email: 'client@example.com' },
  user: {
    emailNotificationsEnabled: true,
    emailNotifyPaymentReceived: true,
  },
  ...overrides,
});

const makePayment = (overrides: Partial<any> = {}) => ({
  id: 'pay_1',
  invoiceId: 'inv_1',
  amount: 100,
  status: PaymentStatus.COMPLETED,
  paymentDate: new Date(),
  paymentNumber: 'PMT-1',
  netAmount: 100,
  ...overrides,
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<any>;
  let email: jest.Mocked<EmailService>;
  const realRandom = Math.random;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        update: jest.fn(),
      },
      invoiceHistory: {
        create: jest.fn(),
      },
    } as any;

    email = {
      sendPaymentReceivedEmail: jest.fn(),
      // PaymentsService also calls this when emailNotificationsEnabled is true
      sendClientPaymentReceiptEmail: jest.fn(),
    } as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        // Minimal notifications mock to satisfy DI
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    Math.random = realRandom;
    jest.useRealTimers();
  });

  describe('create', () => {
    it('creates full payment, updates invoice to PAID, logs history, and sends email when prefs enabled', async () => {
      const invoice = makeInvoice();
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});
      email.sendPaymentReceivedEmail.mockResolvedValue(undefined);

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
        notes: 'note',
      } as any;
      const payment = await service.create('user_1', dto);

      expect(payment).toBeDefined();
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: expect.objectContaining({
          status: InvoiceStatus.PAID,
          paidAt: expect.any(Date),
        }),
      });
      expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: expect.any(String),
          description: 'Invoice fully paid',
        }),
      });
      expect(email.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    });

    it('creates partial payment, updates invoice to PARTIALLY_PAID, logs history, and does not send email if emailNotificationsEnabled is false', async () => {
      const invoice = makeInvoice({
        user: {
          emailNotificationsEnabled: false,
          emailNotifyPaymentReceived: true,
        },
      });
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(
        makePayment({ amount: 50, netAmount: 50 }),
      );
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});

      const dto = {
        invoiceId: 'inv_1',
        amount: 50,
        paymentMethod: 'CASH',
      } as any;
      const payment = await service.create('user_1', dto);

      expect(payment).toBeDefined();
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
      });
      expect(prisma.invoiceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: expect.stringContaining('Partial payment of 50'),
        }),
      });
      expect(email.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    });

    it('does not send email if emailNotifyPaymentReceived is false', async () => {
      const invoice = makeInvoice({
        user: {
          emailNotificationsEnabled: true,
          emailNotifyPaymentReceived: false,
        },
      });
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      await service.create('user_1', dto);

      expect(email.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    });

    it('handles email sending failure gracefully', async () => {
      const invoice = makeInvoice();
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});
      email.sendPaymentReceivedEmail.mockRejectedValue(
        new Error('SMTP failure'),
      );

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const payment = await service.create('user_1', dto);

      expect(payment).toBeDefined();
      expect(email.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
      // No throw despite email failure
    });

    it('throws NotFoundException when invoice not found', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;

      await expect(service.create('user_1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when overpaying', async () => {
      const invoice = makeInvoice({
        totalAmount: 100,
        payments: [{ amount: 80, status: PaymentStatus.COMPLETED }],
      });
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      const dto = {
        invoiceId: 'inv_1',
        amount: 30,
        paymentMethod: 'CASH',
      } as any; // exceeds 20 remaining

      await expect(service.create('user_1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('processPayment', () => {
    it('processes payment successfully and sends email when prefs enabled', async () => {
      jest.useFakeTimers();
      Math.random = () => 0.9; // success

      const invoice = makeInvoice();
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});
      email.sendPaymentReceivedEmail.mockResolvedValue(undefined);

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const promise = service.processPayment('user_1', dto);
      await jest.advanceTimersByTimeAsync(1000);
      const res = await promise;

      expect(res).toHaveProperty('message', 'Payment processed successfully');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
        }),
      );
      expect(email.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    });

    it('processes payment successfully but does not send email when prefs disabled', async () => {
      jest.useFakeTimers();
      Math.random = () => 0.9; // success

      const invoice = makeInvoice({
        user: {
          emailNotificationsEnabled: false,
          emailNotifyPaymentReceived: true,
        },
      });
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const promise = service.processPayment('user_1', dto);
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(email.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    });

    it('processes payment successfully but does not send email when emailNotifyPaymentReceived is false', async () => {
      jest.useFakeTimers();
      Math.random = () => 0.9; // success

      const invoice = makeInvoice({
        user: {
          emailNotificationsEnabled: true,
          emailNotifyPaymentReceived: false,
        },
      });
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const promise = service.processPayment('user_1', dto);
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(email.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    });

    it('handles email sending failure gracefully on success path', async () => {
      jest.useFakeTimers();
      Math.random = () => 0.9; // success

      const invoice = makeInvoice();
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValue(makePayment());
      prisma.invoice.update.mockResolvedValue({});
      prisma.invoiceHistory.create.mockResolvedValue({});
      email.sendPaymentReceivedEmail.mockRejectedValue(
        new Error('SMTP failure'),
      );

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const promise = service.processPayment('user_1', dto);
      await jest.advanceTimersByTimeAsync(1000);
      const res = await promise;

      expect(res).toHaveProperty('message', 'Payment processed successfully');
      expect(email.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when invoice not found', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.processPayment('user_1', {
          invoiceId: 'missing',
          amount: 10,
          paymentMethod: 'CASH',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates failed payment and throws BadRequestException when processing fails', async () => {
      jest.useFakeTimers();
      Math.random = () => 0.05; // failure

      const invoice = makeInvoice();
      prisma.invoice.findFirst.mockResolvedValue(invoice);
      prisma.payment.create.mockResolvedValueOnce(
        makePayment({ status: PaymentStatus.FAILED, netAmount: 0 }),
      );

      const dto = {
        invoiceId: 'inv_1',
        amount: 100,
        paymentMethod: 'CASH',
      } as any;
      const p = service.processPayment('user_1', dto);
      const assertion = expect(p).rejects.toBeInstanceOf(BadRequestException);
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(email.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    });
  });
});
