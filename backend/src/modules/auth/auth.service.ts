import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
    };

    const expiresIn = loginDto.rememberMe ? '30d' : '1d';

    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyName: user.companyName,
        emailVerified: user.emailVerified,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Enforce application config: allowRegistration
    try {
      const row = await this.prisma.systemSettings.findUnique({
        where: { key: 'allowRegistration' },
      });
      const allowRegistration =
        row?.value === undefined ? true : Boolean(row.value as any);
      if (!allowRegistration) {
        throw new BadRequestException('Registration is disabled');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // If settings table is missing, default to allowing registration
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiryHours = Number(
      this.config.get('EMAIL_VERIFICATION_EXPIRATION_HOURS', 48),
    );
    const verificationTokenExpiry = new Date(
      Date.now() + verificationTokenExpiryHours * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
        verificationToken,
        verificationTokenExpiry,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyName: true,
      },
    });

    // Send email verification (fire-and-forget to avoid blocking registration on SMTP issues)
    void (async () => {
      try {
        const fullUser = await this.prisma.user.findUnique({
          where: { id: user.id },
        });
        if (fullUser) {
          await this.emailService.sendEmailVerification(
            fullUser,
            verificationToken,
          );
        }
      } catch (e) {
        // Log and continue without failing registration
        console.error('Failed to send verification email:', e);
      }
    })();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: false, // New users are not verified
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...user,
        emailVerified: false,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(user, resetToken);
    } catch (e) {
      console.error('Failed to send password reset email:', e);
    }

    return { message: 'Password reset email sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: resetPasswordDto.token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successful' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (
      user.verificationTokenExpiry &&
      user.verificationTokenExpiry <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // Send welcome email after successful verification (fire-and-forget to avoid blocking)
    void (async () => {
      try {
        await this.emailService.sendWelcomeEmail(user);
      } catch (e) {
        console.error('Failed to send welcome email:', e);
      }
    })();

    return { message: 'Email verified successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyName: true,
        companyLogo: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        taxNumber: true,
        currency: true,
        invoicePrefix: true,
        invoiceStartNumber: true,
        taxRate: true,
        paymentTerms: true,
        subscriptionPlan: true,
        subscriptionEnd: true,
        invoiceLimit: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async refreshToken(user: { id: string; email: string; role: string }) {
    // Reload user to reflect the latest verification status and profile info
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }
    const payload = {
      sub: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      emailVerified: dbUser.emailVerified,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiryHours = Number(
      this.config.get('EMAIL_VERIFICATION_EXPIRATION_HOURS', 48),
    );
    const verificationTokenExpiry = new Date(
      Date.now() + verificationTokenExpiryHours * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email in the background and don't block the HTTP response
    void (async () => {
      try {
        await this.emailService.sendEmailVerification(user, verificationToken);
      } catch (e) {
        console.error('Failed to send verification email (background):', e);
        // Optionally persist to an error log table if available
      }
    })();

    // Return immediately to avoid client timeouts; email will arrive shortly
    return { message: 'Verification email queued' };
  }
}
