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
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@CurrentUser() user, @Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(user.id, createClientDto);
  }

  @Get()
  findAll(
    @CurrentUser() user,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const query = {
      search,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
    return this.clientsService.findAll(user.id, query);
  }

  @Get('search')
  searchClients(@CurrentUser() user, @Query('q') search: string) {
    return this.clientsService.searchClients(user.id, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.clientsService.findOne(id, user.id);
  }

  @Get(':id/invoices')
  getClientInvoices(@Param('id') id: string, @CurrentUser() user) {
    return this.clientsService.getClientInvoices(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, user.id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.clientsService.remove(id, user.id);
  }
}
