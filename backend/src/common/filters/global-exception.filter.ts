import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = new Set([
      'password',
      'newPassword',
      'currentPassword',
      'token',
    ]);
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }
    const clone: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.has(key)) continue;
      clone[key] = typeof value === 'object' ? this.sanitize(value) : value;
    }
    return clone;
  }

  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message ||
          exception.message ||
          'Error'
        : exception?.message || 'Internal server error';

    const stack = exception?.stack;

    // Attempt to persist error log (ignore failures to avoid masking original error)
    try {
      const prismaAny = this.prisma as any;
      if (prismaAny?.errorLog?.create) {
        await prismaAny.errorLog.create({
          data: {
            level: status >= 500 ? 'ERROR' : 'WARN',
            message: Array.isArray(message)
              ? message.join(', ')
              : String(message),
            stack,
            statusCode: status,
            method: request.method,
            path: request.url,
            userId: (request as any)?.user?.id ?? null,
            context: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              params: this.sanitize(request.params),
              query: this.sanitize(request.query),
              body: this.sanitize(request.body),
            },
          },
        });
      }
    } catch (e) {
      console.error('Failed to persist ErrorLog:', e?.message || e);
    }

    const payload: any = {
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(payload);
  }
}
