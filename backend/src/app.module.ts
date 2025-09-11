import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecurringInvoicesModule } from './modules/recurring-invoices/recurring-invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PublicConfigModule } from './modules/public-config/public-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    InvoicesModule,
    PaymentsModule,
    AnalyticsModule,
    AdminModule,
    EmailModule,
    RecurringInvoicesModule,
    NotificationsModule,
    PublicConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
