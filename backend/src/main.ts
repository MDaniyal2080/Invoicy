import 'reflect-metadata';
// Preload iconv-lite encodings to avoid rare "Cannot find module '../encodings'" errors
// that can occur when raw-body/body-parser triggers a lazy require in certain environments.
import 'iconv-lite/encodings';
import * as nodeCrypto from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import * as express from 'express';
import { join } from 'path';

// Some environments do not expose a global `crypto` object by default. Ensure it exists.
// This is required by some dependencies (e.g., @nestjs/schedule) which call `crypto.randomUUID()`.
if (
  typeof (globalThis as any).crypto === 'undefined' ||
  typeof (globalThis as any).crypto.randomUUID !== 'function'
) {
  (globalThis as any).crypto = nodeCrypto as any;
}

async function bootstrap() {
  // Enable rawBody for Stripe webhooks verification (available at /api/webhooks/stripe)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  // Trust proxy (Railway/Netlify/other PaaS)
  const httpAdapter = app.getHttpAdapter();
  const instance: any = httpAdapter.getInstance?.() ?? (httpAdapter as any);
  if (instance?.set) instance.set('trust proxy', 1);
  app.use(compression());
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10), // limit each IP per window
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Enable CORS
  const allowedOrigins = process.env.FRONTEND_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Security middleware (allow cross-origin loading of assets like images)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Static file serving for uploaded assets
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  // Global exception filter for error logging
  const prisma = app.get(PrismaService);
  app.useGlobalFilters(new GlobalExceptionFilter(prisma));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend server running on http://localhost:${port}`);
}
bootstrap();
