import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoiceStatus } from '../../common/enums';

@Controller('invoices')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@CurrentUser() user, @Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(user.id, createInvoiceDto);
  }

  @Get('statistics')
  getStatistics(@CurrentUser() user) {
    return this.invoicesService.getStatistics(user.id);
  }

  @Get()
  findAll(
    @CurrentUser() user,
    @Query('status') status?: InvoiceStatus,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query = {
      status,
      clientId,
      search,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy,
      sortDir,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.invoicesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, user.id, updateInvoiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.remove(id, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body('status') status: InvoiceStatus,
  ) {
    return this.invoicesService.updateStatus(id, user.id, status);
  }

  @Post(':id/send')
  sendInvoice(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.sendInvoice(id, user.id);
  }

  @Post('bulk/send')
  sendInvoicesBulk(@Body('ids') ids: string[], @CurrentUser() user) {
    return this.invoicesService.sendInvoicesBulk(ids, user.id);
  }

  @Post('bulk/status')
  updateStatusBulk(
    @Body('ids') ids: string[],
    @Body('status') status: InvoiceStatus,
    @CurrentUser() user,
  ) {
    return this.invoicesService.updateStatusBulk(ids, user.id, status);
  }

  @Post('bulk/mark-paid')
  markPaidBulk(@Body('ids') ids: string[], @CurrentUser() user) {
    return this.invoicesService.markPaidBulk(ids, user.id);
  }

  @Post('bulk/delete')
  deleteBulk(@Body('ids') ids: string[], @CurrentUser() user) {
    return this.invoicesService.removeBulk(ids, user.id);
  }

  @Get(':id/download')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user,
    @Res() res: Response,
    @Query('template') template?: string,
    @Query('color') color?: string,
    @Query('accentColor') accentColor?: string,
    @Query('headerBorderColor') headerBorderColor?: string,
    @Query('tableHeaderColor') tableHeaderColor?: string,
    @Query('font') font?: string,
    @Query('layout') layout?: string,
    @Query('footer') footer?: string,
    @Query('pageSize') pageSize?: string,
    @Query('margins') margins?: string,
    @Query('watermarkText') watermarkText?: string,
    @Query('showSignature') showSignature?: string,
    @Query('customFields') customFields?: string,
    @Query('logoSize') logoSize?: string,
    @Query('headerStyle') headerStyle?: string,
  ) {
    try {
      // Debug log for tracing issues in production

      console.log('GET /invoices/:id/download', {
        id,
        userId: user?.id,
        template,
        color,
        accentColor,
        headerBorderColor,
        tableHeaderColor,
        font,
        layout,
        footer,
        pageSize,
        margins,
        watermarkText,
        showSignature,
        logoSize,
        headerStyle,
      });

      const options = {
        template,
        colorScheme: color, // legacy
        accentColor: accentColor || color,
        headerBorderColor,
        tableHeaderColor,
        font,
        layout,
        footer,
        pageSize,
        margins,
        watermarkText,
        showSignature:
          typeof showSignature === 'string'
            ? ['true', '1', 'yes', 'on'].includes(showSignature.toLowerCase())
            : undefined,
        customFields: (() => {
          try {
            return customFields ? JSON.parse(customFields) : undefined;
          } catch {
            return undefined;
          }
        })(),
        logoSize,
        headerStyle,
      } as any;
      const pdfBuffer = await this.invoicesService.downloadPdf(
        id,
        user.id,
        options,
      );

      console.log('PDF generated, bytes:', pdfBuffer?.length ?? 0);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      });
      res.status(HttpStatus.OK);
      res.end(pdfBuffer);
    } catch (err: any) {
      console.error(
        'Failed to generate/download invoice PDF:',
        err?.message || err,
      );
      try {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Failed to generate invoice PDF',
          error: err?.message || 'Unknown error',
        });
      } catch {
        // If response has already started, just end it
        try {
          res.end();
        } catch {}
      }
    }
  }

  @Post(':id/duplicate')
  duplicateInvoice(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.duplicateInvoice(id, user.id);
  }

  @Post(':id/cancel')
  cancelInvoice(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.cancelInvoice(id, user.id);
  }

  // Sharing endpoints
  @Patch(':id/share')
  updateShare(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body('enable') enable?: boolean,
  ) {
    return this.invoicesService.updateShare(id, user.id, { enable });
  }

  @Post(':id/share/regenerate')
  regenerateShare(@Param('id') id: string, @CurrentUser() user) {
    return this.invoicesService.updateShare(id, user.id, { regenerate: true });
  }
}
