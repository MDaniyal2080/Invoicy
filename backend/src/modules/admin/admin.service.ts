import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserByAdminDto } from './dto/update-user.dto';
import { UserRole } from '../../common/enums';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      totalInvoices,
      totalRevenue,
      totalClients,
      systemSettings,
    ] = await Promise.all([
      // Total users
      this.prisma.user.count(),

      // Active users (logged in last 30 days)
      this.prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Total invoices system-wide
      this.prisma.invoice.count(),

      // Total revenue system-wide
      this.prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { totalAmount: true },
      }),

      // Total clients system-wide
      this.prisma.client.count(),

      // System settings (key/value aggregate)
      this.getSystemSettings(),
    ]);

    // Subscription distribution
    const subscriptionStats = await this.prisma.user.groupBy({
      by: ['subscriptionPlan'],
      _count: { subscriptionPlan: true },
    });

    // Monthly growth
    const monthlyGrowth = await this.getMonthlyUserGrowth();

    return {
      totalUsers,
      activeUsers,
      totalInvoices,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalClients,
      subscriptionStats: subscriptionStats.map((stat) => ({
        plan: stat.subscriptionPlan,
        count: stat._count.subscriptionPlan,
      })),
      monthlyGrowth,
      systemSettings,
    };
  }

  async getAllUsers(query?: {
    search?: string;
    role?: UserRole;
    subscriptionPlan?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.role) {
      where.role = query.role;
    }

    if (query?.subscriptionPlan) {
      where.subscriptionPlan = query.subscriptionPlan;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          role: true,
          subscriptionPlan: true,
          subscriptionEnd: true,
          invoiceLimit: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          _count: {
            select: {
              invoices: true,
              clients: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            invoices: true,
            clients: true,
          },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { client: true },
        },
        activityLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate user statistics
    const [totalRevenue, paidInvoices, pendingInvoices] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { userId, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({
        where: { userId, status: 'PAID' },
      }),
      this.prisma.invoice.count({
        where: { userId, status: { in: ['SENT', 'VIEWED'] } },
      }),
    ]);

    return {
      user,
      stats: {
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        paidInvoices,
        pendingInvoices,
        totalInvoices: user._count.invoices,
        totalClients: user._count.clients,
      },
    };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserByAdminDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
    });

    // Log admin action
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'USER_UPDATED_BY_ADMIN',
        entity: 'user',
        entityId: userId,
        description: `User profile updated by admin`,
        ipAddress: '0.0.0.0', // TODO: Get from request
      },
    });

    return updatedUser;
  }

  async suspendUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend admin users');
    }

    const suspendedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Log admin action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'USER_SUSPENDED',
        entity: 'user',
        entityId: userId,
        description: `User suspended by admin ${adminId}`,
        ipAddress: '0.0.0.0',
      },
    });

    return suspendedUser;
  }

  async activateUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    // Log admin action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'USER_ACTIVATED',
        entity: 'user',
        entityId: userId,
        description: `User activated by admin ${adminId}`,
        ipAddress: '0.0.0.0',
      },
    });

    return activatedUser;
  }

  async deleteUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot delete admin users');
    }

    // Delete user and all related data (cascade delete)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Log admin action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'USER_DELETED',
        entity: 'user',
        entityId: userId,
        description: `User ${user.email} deleted by admin`,
        ipAddress: '0.0.0.0',
      },
    });

    return { message: 'User deleted successfully' };
  }

  async resetUserPassword(
    userId: string,
    dto: ResetUserPasswordDto,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'USER_PASSWORD_RESET',
        entity: 'user',
        entityId: userId,
        description: `Password reset by admin ${adminId}`,
        ipAddress: '0.0.0.0',
      },
    });

    return { message: 'Password reset successfully' };
  }

  async getSystemSettings() {
    const defaults: Record<string, any> = {
      siteName: 'Invoicy',
      companyName: 'Invoicy',
      companyEmail: 'admin@invoicy.com',
      companyPhone: '',
      companyAddress: '',
      defaultCurrency: 'USD',
      defaultTaxRate: 0,
      defaultPaymentTerms: 30,
      timezone: 'UTC',
      emailNotifications: true,
      autoBackup: true,
      maintenanceMode: false,
      // Application configuration
      allowRegistration: true,
      maxUploadMB: 10,
      // Email (SMTP) defaults - editable via Admin Settings UI
      EMAIL_HOST: 'smtp.gmail.com',
      EMAIL_PORT: 587,
      EMAIL_SECURE: false,
      EMAIL_USER: '',
      EMAIL_PASSWORD: '',
      EMAIL_FROM: 'noreply@invoicy.com',
      // Provider options
      EMAIL_PROVIDER: 'SMTP', // SMTP | SENDGRID
      SENDGRID_API_KEY: '',
      EMAIL_TRACK_OPENS: true,
      EMAIL_TRACK_CLICKS: true,
      EMAIL_CONNECTION_TIMEOUT_MS: 10000,
      EMAIL_GREETING_TIMEOUT_MS: 10000,
      EMAIL_SOCKET_TIMEOUT_MS: 20000,
      // Payments (Stripe)
      STRIPE_PUBLISHABLE_KEY: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      STRIPE_PRICE_BASIC: '',
      STRIPE_PRICE_PREMIUM: '',
      // Platform fee in basis points (1% = 100 bps). Used for Connect destination charges
      STRIPE_PLATFORM_FEE_BPS: 0,
    };

    const entries = await this.prisma.systemSettings.findMany();
    const current: Record<string, any> = { ...defaults };
    for (const row of entries) {
      current[row.key] = row.value;
    }
    // Mask sensitive values
    if (
      typeof current.EMAIL_PASSWORD === 'string' &&
      current.EMAIL_PASSWORD.length > 0
    ) {
      current.EMAIL_PASSWORD = '__SECRET__';
    }
    if (
      typeof current.SENDGRID_API_KEY === 'string' &&
      current.SENDGRID_API_KEY.length > 0
    ) {
      current.SENDGRID_API_KEY = '__SECRET__';
    }
    if (
      typeof current.STRIPE_SECRET_KEY === 'string' &&
      current.STRIPE_SECRET_KEY.length > 0
    ) {
      current.STRIPE_SECRET_KEY = '__SECRET__';
    }
    if (
      typeof current.STRIPE_WEBHOOK_SECRET === 'string' &&
      current.STRIPE_WEBHOOK_SECRET.length > 0
    ) {
      current.STRIPE_WEBHOOK_SECRET = '__SECRET__';
    }
    return current;
  }

  async updateSystemSettings(data: any) {
    // Upsert each key/value pair according to SystemSettings model
    const entries = Object.entries(data || {});
    for (const [key, valueRaw] of entries) {
      // Skip updating password when sentinel is provided
      if (key === 'EMAIL_PASSWORD' && valueRaw === '__SECRET__') {
        continue;
      }

      let value = valueRaw as any;

      switch (key) {
        case 'maxUploadMB': {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 1 || n > 10240) {
            throw new BadRequestException(
              'maxUploadMB must be a number between 1 and 10240',
            );
          }
          value = Math.floor(n);
          break;
        }
        case 'EMAIL_HOST': {
          const providerInput = String(
            (data?.EMAIL_PROVIDER ?? '') || '',
          ).toUpperCase();
          const host = typeof value === 'string' ? value.trim() : '';
          if (providerInput !== 'SENDGRID') {
            if (!host) throw new BadRequestException('EMAIL_HOST is required');
          }
          value = host;
          break;
        }
        case 'EMAIL_PORT': {
          const port = Number(value);
          if (!Number.isFinite(port) || port < 1 || port > 65535) {
            throw new BadRequestException(
              'EMAIL_PORT must be a number between 1 and 65535',
            );
          }
          value = port;
          break;
        }
        case 'EMAIL_SECURE': {
          value =
            value === true || value === 'true' || value === '1' || value === 1;
          break;
        }
        case 'EMAIL_PROVIDER': {
          const provider = String(value || '').toUpperCase();
          if (!['SMTP', 'SENDGRID'].includes(provider)) {
            throw new BadRequestException(
              'EMAIL_PROVIDER must be either SMTP or SENDGRID',
            );
          }
          value = provider;
          break;
        }
        case 'SENDGRID_API_KEY': {
          // Support sentinel to keep existing
          if (value === '__SECRET__') {
            continue; // skip upsert to preserve existing secret
          }
          value = String(value || '').trim();
          break;
        }
        case 'EMAIL_TRACK_OPENS':
        case 'EMAIL_TRACK_CLICKS': {
          value =
            value === true || value === 'true' || value === '1' || value === 1;
          break;
        }
        case 'EMAIL_FROM': {
          const from = String(value || '').trim();
          const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
          if (!emailRe.test(from)) {
            throw new BadRequestException(
              'EMAIL_FROM must be a valid email address',
            );
          }
          value = from;
          break;
        }
        case 'EMAIL_CONNECTION_TIMEOUT_MS':
        case 'EMAIL_GREETING_TIMEOUT_MS':
        case 'EMAIL_SOCKET_TIMEOUT_MS': {
          const ms = Number(value);
          if (!Number.isFinite(ms) || ms < 0 || ms > 600000) {
            throw new BadRequestException(
              `${key} must be a number between 0 and 600000 milliseconds`,
            );
          }
          value = ms;
          break;
        }
        // Stripe settings
        case 'STRIPE_PUBLISHABLE_KEY': {
          value = String(value || '').trim();
          break;
        }
        case 'STRIPE_SECRET_KEY':
        case 'STRIPE_WEBHOOK_SECRET': {
          if (value === '__SECRET__') {
            continue; // keep existing
          }
          value = String(value || '').trim();
          break;
        }
        case 'STRIPE_PRICE_BASIC':
        case 'STRIPE_PRICE_PREMIUM': {
          value = String(value || '').trim();
          break;
        }
        case 'STRIPE_PLATFORM_FEE_BPS': {
          const bps = Number(value);
          if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
            throw new BadRequestException(
              'STRIPE_PLATFORM_FEE_BPS must be between 0 and 10000 (100% = 10000)',
            );
          }
          value = Math.floor(bps);
          break;
        }
        default: {
          // Coerce common boolean flags when sent as strings
          if (
            [
              'emailNotifications',
              'autoBackup',
              'maintenanceMode',
              'allowRegistration',
            ].includes(key)
          ) {
            value =
              value === true ||
              value === 'true' ||
              value === '1' ||
              value === 1;
          }
          break;
        }
      }

      await this.prisma.systemSettings.upsert({
        where: { key },
        create: { key, value: value },
        update: { value: value },
      });
    }
    // Return merged settings (with masking applied)
    return this.getSystemSettings();
  }

  async getActivityLogs(query?: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.userId) {
      where.userId = query.userId;
    }

    if (query?.action) {
      where.action = query.action;
    }

    if (query?.startDate && query?.endDate) {
      where.createdAt = {
        gte: query.startDate,
        lte: query.endDate,
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getErrorLogs(query?: {
    search?: string;
    level?: string;
    statusCode?: number;
    method?: string;
    path?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.level) where.level = query.level;
    if (query?.statusCode) where.statusCode = query.statusCode;
    if (query?.method) where.method = query.method;
    if (query?.path) where.path = { contains: query.path, mode: 'insensitive' };
    if (query?.search) {
      where.OR = [
        { message: { contains: query.search, mode: 'insensitive' } },
        { path: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.startDate && query?.endDate) {
      where.createdAt = { gte: query.startDate, lte: query.endDate };
    }

    const prismaAny = this.prisma as any;
    const [logs, total] = await Promise.all([
      prismaAny.errorLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prismaAny.errorLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteErrorLog(id: string) {
    const prismaAny = this.prisma as any;
    try {
      await prismaAny.errorLog.delete({ where: { id } });
      return { message: 'Error log deleted' };
    } catch (e) {
      throw new NotFoundException('Error log not found');
    }
  }

  async clearErrorLogs(olderThanDays?: number) {
    const prismaAny = this.prisma as any;
    const where: any = {};
    if (olderThanDays && olderThanDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      where.createdAt = { lt: cutoff };
    }
    const res = await prismaAny.errorLog.deleteMany({ where });
    return { message: 'Error logs cleared', count: res.count };
  }

  async getInvoiceStatistics() {
    const [
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { status: 'PAID' } }),
      this.prisma.invoice.count({
        where: { status: { in: ['SENT', 'VIEWED'] } },
      }),
      this.prisma.invoice.count({
        where: {
          status: { in: ['SENT', 'VIEWED'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.getMonthlyRevenue(),
    ]);

    return {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      monthlyRevenue,
    };
  }

  // Helper methods
  private async getMonthlyUserGrowth() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
      },
    });

    const grouped = {};
    users.forEach((user) => {
      const date = new Date(user.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([month, count]) => ({
      month,
      count,
    }));
  }

  private async getMonthlyRevenue() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: sixMonthsAgo },
      },
      select: {
        paidAt: true,
        totalAmount: true,
      },
    });

    const grouped = {};
    invoices.forEach((invoice) => {
      const date = new Date(invoice.paidAt!);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = { month: key, amount: 0 };
      }
      grouped[key].amount += invoice.totalAmount;
    });

    return Object.values(grouped);
  }

  // System management: backup + maintenance
  async triggerBackup(adminId: string) {
    const now = new Date();
    const backupId = `bkp_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = now.toISOString();
    const safeTs = timestamp.replace(/[:.]/g, '-');
    const file = `backup_${safeTs}.json`;

    // Persist lightweight metadata in SystemSettings
    await this.prisma.$transaction([
      this.prisma.systemSettings.upsert({
        where: { key: 'LAST_BACKUP_AT' },
        create: { key: 'LAST_BACKUP_AT', value: timestamp as any },
        update: { value: timestamp as any },
      }),
      this.prisma.systemSettings.upsert({
        where: { key: 'LAST_BACKUP_ID' },
        create: { key: 'LAST_BACKUP_ID', value: backupId as any },
        update: { value: backupId as any },
      }),
      this.prisma.systemSettings.upsert({
        where: { key: 'LAST_BACKUP_FILE' },
        create: { key: 'LAST_BACKUP_FILE', value: file as any },
        update: { value: file as any },
      }),
    ]);

    // Log admin action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'SYSTEM_BACKUP_TRIGGERED',
        entity: 'system',
        entityId: backupId,
        description: `System backup triggered by admin ${adminId}`,
      },
    });

    return { success: true, backupId, file, createdAt: timestamp };
  }

  async getBackupStatus() {
    const rows = await this.prisma.systemSettings.findMany({
      where: {
        key: {
          in: [
            'LAST_BACKUP_AT',
            'LAST_BACKUP_ID',
            'LAST_BACKUP_FILE',
            'maintenanceMode',
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value])) as Map<string, any>;
    return {
      lastBackupAt: map.get('LAST_BACKUP_AT') || null,
      lastBackupId: map.get('LAST_BACKUP_ID') || null,
      lastBackupFile: map.get('LAST_BACKUP_FILE') || null,
      maintenanceMode: !!map.get('maintenanceMode'),
    };
  }

  async setMaintenanceMode(enabled: boolean) {
    await this.prisma.systemSettings.upsert({
      where: { key: 'maintenanceMode' },
      create: { key: 'maintenanceMode', value: enabled as any },
      update: { value: enabled as any },
    });
    return { maintenanceMode: enabled };
  }
}
