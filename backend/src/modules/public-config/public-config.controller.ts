import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('config')
export class PublicConfigController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('public')
  async getPublicConfig() {
    const row = await this.prisma.systemSettings.findUnique({
      where: { key: 'siteName' },
    });
    const siteName = row?.value ? String(row.value as any) : 'Invoicy';
    const tzRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'timezone' },
    });
    const timezone = tzRow?.value ? String(tzRow.value as any) : 'UTC';
    const curRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'defaultCurrency' },
    });
    const defaultCurrency = curRow?.value ? String(curRow.value as any) : 'USD';
    const regRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'allowRegistration' },
    });
    const allowRegistration =
      regRow?.value === undefined ? true : Boolean(regRow.value as any);
    const upRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'maxUploadMB' },
    });
    const maxUploadMB =
      upRow?.value === undefined ? 10 : Number(upRow.value as any) || 10;
    const maintRow = await this.prisma.systemSettings.findUnique({
      where: { key: 'maintenanceMode' },
    });
    const maintenanceMode = Boolean(maintRow?.value as any);
    return {
      siteName,
      timezone,
      defaultCurrency,
      allowRegistration,
      maxUploadMB,
      maintenanceMode,
    };
  }
}
