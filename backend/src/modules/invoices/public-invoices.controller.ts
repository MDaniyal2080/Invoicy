import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InvoicesService } from './invoices.service';

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':shareId')
  getByShareId(@Param('shareId') shareId: string, @Req() req: Request) {
    const ipHeader = (req.headers['x-forwarded-for'] as string) || req.ip;
    const ip = Array.isArray(ipHeader)
      ? ipHeader[0]
      : ipHeader?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.invoicesService.getPublicInvoiceByShareId(shareId, {
      ip,
      userAgent,
    });
  }
}
