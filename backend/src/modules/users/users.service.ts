import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfileDto,
  UpdateSettingsDto,
  ChangePasswordDto,
} from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { Plan } from '../../common/enums';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        companyLogo: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        taxNumber: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        companyLogo: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        taxNumber: true,
      },
    });

    return user;
  }

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        invoicePrefix: true,
        invoiceStartNumber: true,
        currency: true,
        taxRate: true,
        paymentTerms: true,
        invoiceNotes: true,
        invoiceFooter: true,
        // Notification preferences
        emailNotificationsEnabled: true,
        emailNotifyNewInvoice: true,
        emailNotifyPaymentReceived: true,
        emailNotifyInvoiceOverdue: true,
        emailNotifyWeeklySummary: true,
        emailNotifyNewClientAdded: true,
        subscriptionPlan: true,
        subscriptionEnd: true,
        invoiceLimit: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Normalize inconsistent fields derived from plan defaults
    const plan = (user as any).subscriptionPlan as Plan;
    const planUpper = String(plan || '').toUpperCase();
    const defaultLimit =
      planUpper === 'FREE' ? 5 : planUpper === 'BASIC' ? 50 : 0; // PREMIUM/ENTERPRISE => 0 = unlimited
    const stored = (user as any).invoiceLimit as any;
    const storedNum = Number(stored);
    const hasValidStored = Number.isFinite(storedNum) && storedNum > 0;
    const effectiveLimit = defaultLimit === 0 ? 0 : hasValidStored ? storedNum : defaultLimit;
    const effectiveEnd = planUpper === 'FREE' ? null : (user as any).subscriptionEnd;

    return {
      ...user,
      invoiceLimit: effectiveLimit,
      subscriptionEnd: effectiveEnd,
    } as typeof user;
  }

  async updateSettings(userId: string, updateSettingsDto: UpdateSettingsDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateSettingsDto,
      select: {
        invoicePrefix: true,
        invoiceStartNumber: true,
        currency: true,
        taxRate: true,
        paymentTerms: true,
        invoiceNotes: true,
        invoiceFooter: true,
        // Notification preferences
        emailNotificationsEnabled: true,
        emailNotifyNewInvoice: true,
        emailNotifyPaymentReceived: true,
        emailNotifyInvoiceOverdue: true,
        emailNotifyWeeklySummary: true,
        emailNotifyNewClientAdded: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account deleted successfully' };
  }

  async uploadLogo(userId: string, logoUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { companyLogo: logoUrl },
      select: {
        companyLogo: true,
      },
    });

    return user;
  }

  // Mock billing operations
  async upgradePlanMock(userId: string, plan: 'BASIC' | 'PREMIUM' = 'PREMIUM') {
    const targetPlan = plan === 'BASIC' ? Plan.BASIC : Plan.PREMIUM;
    // 30 days from now
    const subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const invoiceLimit = targetPlan === Plan.BASIC ? 50 : 0; // 0 means unlimited in enforcement checks

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: targetPlan as any,
        subscriptionEnd,
        invoiceLimit,
      },
      select: {
        subscriptionPlan: true,
        subscriptionEnd: true,
        invoiceLimit: true,
        emailNotificationsEnabled: true,
        email: true,
        firstName: true,
        companyName: true,
      },
    });

    // Fire-and-forget email notification
    if (updated?.emailNotificationsEnabled) {
      void (async () => {
        try {
          await this.emailService.sendPlanUpgradedEmail(
            {
              email: updated.email,
              firstName: updated.firstName,
              companyName: updated.companyName,
            } as any,
            String(updated.subscriptionPlan),
            updated.subscriptionEnd,
            updated.invoiceLimit,
          );
        } catch (e) {
          console.error('Failed to send plan upgraded email:', e?.message || e);
        }
      })();
    }

    return {
      subscriptionPlan: updated.subscriptionPlan,
      subscriptionEnd: updated.subscriptionEnd,
      invoiceLimit: updated.invoiceLimit,
      message: `Upgraded to ${targetPlan} (mock)`,
    } as const;
  }

  async downgradeToFreeMock(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: Plan.FREE as any,
        subscriptionEnd: null,
        invoiceLimit: 5,
      },
      select: {
        subscriptionPlan: true,
        subscriptionEnd: true,
        invoiceLimit: true,
        emailNotificationsEnabled: true,
        email: true,
        firstName: true,
        companyName: true,
      },
    });

    if (updated?.emailNotificationsEnabled) {
      void (async () => {
        try {
          await this.emailService.sendPlanDowngradedEmail(
            {
              email: updated.email,
              firstName: updated.firstName,
              companyName: updated.companyName,
            } as any,
            String(updated.subscriptionPlan),
          );
        } catch (e) {
          console.error(
            'Failed to send plan downgraded email:',
            e?.message || e,
          );
        }
      })();
    }

    return {
      subscriptionPlan: updated.subscriptionPlan,
      subscriptionEnd: updated.subscriptionEnd,
      invoiceLimit: updated.invoiceLimit,
      message: 'Downgraded to FREE (mock)',
    } as const;
  }
}
