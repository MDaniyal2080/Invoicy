import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserByAdminDto } from './dto/update-user.dto';
import { UserRole } from '../../common/enums';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { EmailService } from '../email/email.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly emailService: EmailService,
  ) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  getAllUsers(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('subscriptionPlan') subscriptionPlan?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers({
      search,
      role,
      subscriptionPlan,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('users/:id')
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Put('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserByAdminDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string, @CurrentUser() admin) {
    return this.adminService.suspendUser(id, admin.id);
  }

  @Post('users/:id/activate')
  activateUser(@Param('id') id: string, @CurrentUser() admin) {
    return this.adminService.activateUser(id, admin.id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() admin) {
    return this.adminService.deleteUser(id, admin.id);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() admin,
  ) {
    return this.adminService.resetUserPassword(id, dto, admin.id);
  }

  @Get('settings')
  getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Put('settings')
  updateSystemSettings(@Body() data: any) {
    return this.adminService.updateSystemSettings(data);
  }

  // SMTP testing endpoints
  @Post('settings/test-smtp')
  testSmtp(@Body() overrides: Record<string, any> = {}) {
    return this.emailService.verifySmtp(overrides);
  }

  @Post('settings/test-email')
  async testEmail(
    @Body() body: { to?: string; overrides?: Record<string, any> },
  ) {
    const to = body?.to?.trim();
    if (!to) throw new BadRequestException('Recipient email (to) is required');
    return this.emailService.sendTestEmail(to, body?.overrides || {});
  }

  @Post('settings/test-invoice-email')
  async testInvoiceEmail(
    @Body() body: { to?: string; overrides?: Record<string, any> },
  ) {
    const to = body?.to?.trim();
    if (!to) throw new BadRequestException('Recipient email (to) is required');
    return this.emailService.sendTestInvoiceEmail(to, body?.overrides || {});
  }

  @Get('settings/email-preview')
  async previewEmail(@Query('type') type?: string) {
    const t = (type as any) || 'welcome';
    return this.emailService.previewTemplate(t);
  }

  @Get('activity-logs')
  getActivityLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getActivityLogs({
      userId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('invoice-statistics')
  getInvoiceStatistics() {
    return this.adminService.getInvoiceStatistics();
  }

  // System Management: Backup & Maintenance
  @Get('backup/status')
  getBackupStatus() {
    return this.adminService.getBackupStatus();
  }

  @Post('backup/run')
  runBackup(@CurrentUser() admin) {
    return this.adminService.triggerBackup(admin.id);
  }

  @Post('maintenance')
  setMaintenance(@Body() body: { enabled?: boolean | string | number }) {
    const v = (body as any)?.enabled;
    const enabled = v === true || v === 'true' || v === 1 || v === '1';
    return this.adminService.setMaintenanceMode(enabled);
  }

  @Get('error-logs')
  getErrorLogs(
    @Query('search') search?: string,
    @Query('level') level?: string,
    @Query('statusCode') statusCode?: string,
    @Query('method') method?: string,
    @Query('path') path?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getErrorLogs({
      search,
      level,
      statusCode: statusCode ? parseInt(statusCode) : undefined,
      method,
      path,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Delete('error-logs/:id')
  deleteErrorLog(@Param('id') id: string) {
    return this.adminService.deleteErrorLog(id);
  }

  @Delete('error-logs')
  clearErrorLogs(@Query('olderThanDays') olderThanDays?: string) {
    return this.adminService.clearErrorLogs(
      olderThanDays ? parseInt(olderThanDays) : undefined,
    );
  }
}
