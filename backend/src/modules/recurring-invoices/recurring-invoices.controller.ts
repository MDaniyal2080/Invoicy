import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseEnumPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import { RecurringStatus } from '../../common/enums';

@UseGuards(JwtAuthGuard)
@Controller('recurring-invoices')
export class RecurringInvoicesController {
  constructor(private readonly service: RecurringInvoicesService) {}

  @Post()
  create(@CurrentUser() user, @Body() dto: CreateRecurringInvoiceDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user,
    @Query('status', new ParseEnumPipe(RecurringStatus, { optional: true }))
    status?: RecurringStatus,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.id, {
      status,
      clientId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() dto: UpdateRecurringInvoiceDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.service.remove(id, user.id);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user) {
    return this.service.pause(id, user.id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user) {
    return this.service.resume(id, user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user) {
    return this.service.cancel(id, user.id);
  }

  @Post(':id/run-now')
  runNow(@Param('id') id: string, @CurrentUser() user) {
    return this.service.runNow(id, user.id);
  }

  // Optional admin/utility endpoint to trigger processing manually
  @Post('process-due')
  processDue() {
    return this.service.processDue();
  }
}
