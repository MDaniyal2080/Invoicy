import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });

    if (!fullUser?.emailVerified) {
      throw new ForbiddenException({
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
      });
    }

    return true;
  }
}
