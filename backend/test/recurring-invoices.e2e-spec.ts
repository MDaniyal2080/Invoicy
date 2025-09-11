import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function issueTestToken(
  secret: string,
  userId = 'user_1',
): Promise<string> {
  const jwt = new JwtService({ secret });
  return jwt.signAsync({ sub: userId, email: 'e2e@example.com' });
}

describe('Recurring Invoices - Status Filter (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    // Ensure JWT secret for strategy
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

    const prismaMock: any = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_1',
          email: 'e2e@example.com',
          isActive: true,
          role: 'USER',
          firstName: 'E2E',
          lastName: 'Tester',
        }),
      },
      recurringInvoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts configuration relevant to tests
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    token = await issueTestToken(process.env.JWT_SECRET, 'user_1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/recurring-invoices (no status) -> 200 OK with paginated shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/recurring-invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toBeDefined();
    expect(typeof res.body).toBe('object');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('GET /api/recurring-invoices?status=ACTIVE -> 200 OK', async () => {
    await request(app.getHttpServer())
      .get('/api/recurring-invoices?status=ACTIVE')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('GET /api/recurring-invoices?status=PAUSED -> 200 OK', async () => {
    await request(app.getHttpServer())
      .get('/api/recurring-invoices?status=PAUSED')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('GET /api/recurring-invoices?status=CANCELLED -> 200 OK', async () => {
    await request(app.getHttpServer())
      .get('/api/recurring-invoices?status=CANCELLED')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('GET /api/recurring-invoices?status=INVALID -> 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/recurring-invoices?status=INVALID')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toHaveProperty('message');
  });
});
