import { Module } from '@nestjs/common';
import { PublicConfigController } from './public-config.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicConfigController],
})
export class PublicConfigModule {}
