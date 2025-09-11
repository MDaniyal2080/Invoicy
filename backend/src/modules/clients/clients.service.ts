import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, createClientDto: CreateClientDto) {
    // Check if client with same email already exists for this user
    const existingClient = await this.prisma.client.findFirst({
      where: {
        userId,
        email: createClientDto.email,
      },
    });

    if (existingClient) {
      throw new BadRequestException('Client with this email already exists');
    }

    const client = await this.prisma.client.create({
      data: {
        ...createClientDto,
        userId,
      },
    });

    // Notify user if preferences allow
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.emailNotificationsEnabled && user?.emailNotifyNewClientAdded) {
        await this.emailService.sendNewClientAddedEmail(
          user as any,
          client as any,
        );
      }
    } catch (err) {
      // Do not fail creation due to email issues
      console.error('Failed to send new client added email:', err);
    }

    // Emit SSE event (non-blocking)
    try {
      this.notifications.emit(userId, 'client.created', {
        id: client.id,
        name: client.name,
      });
    } catch {}

    return client;
  }

  async findAll(
    userId: string,
    query?: { search?: string; isActive?: boolean },
  ) {
    const where: any = { userId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, userId: string, updateClientDto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
    // Emit SSE event (non-blocking)
    try {
      this.notifications.emit(userId, 'client.updated', {
        id,
        name: (updated as any)?.name,
      });
    } catch {}

    return updated;
  }

  async remove(id: string, userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Check if client has invoices
    const invoiceCount = await this.prisma.invoice.count({
      where: { clientId: id },
    });

    if (invoiceCount > 0) {
      throw new BadRequestException(
        'Cannot delete client with existing invoices',
      );
    }

    await this.prisma.client.delete({
      where: { id },
    });

    // Emit SSE event (non-blocking)
    try {
      this.notifications.emit(userId, 'client.deleted', { id });
    } catch {}

    return { message: 'Client deleted successfully' };
  }

  async getClientInvoices(id: string, userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { clientId: id, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
      },
    });

    return invoices;
  }

  async searchClients(userId: string, search: string) {
    return this.prisma.client.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
  }
}
