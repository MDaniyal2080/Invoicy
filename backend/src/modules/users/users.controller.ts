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
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  UpdateProfileDto,
  UpdateSettingsDto,
  ChangePasswordDto,
} from './dto/update-user.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@Controller('users')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user) {
    return this.usersService.getSettings(user.id);
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.id, updateSettingsDto);
  }

  @Put('password')
  async changePassword(
    @CurrentUser() user,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Delete('account')
  async deleteAccount(@CurrentUser() user) {
    return this.usersService.deleteAccount(user.id);
  }

  @Post('upload-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'logos');
          try {
            fs.mkdirSync(dir, { recursive: true });
          } catch (err) {
            void err;
          }
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname) || '';
          cb(null, `logo-${unique}${extension}`);
        },
      }),
    }),
  )
  async uploadLogo(
    @CurrentUser() user,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    // File saved by Multer to /uploads/logos with generated filename
    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.usersService.uploadLogo(user.id, logoUrl);
  }

  // Mock billing endpoints (no real payment integration)
  @Post('upgrade-mock')
  async upgradeMock(
    @CurrentUser() user,
    @Body() body: { plan?: 'BASIC' | 'PREMIUM' },
  ) {
    const plan = body?.plan === 'BASIC' ? 'BASIC' : 'PREMIUM';
    return this.usersService.upgradePlanMock(user.id, plan);
  }

  @Post('downgrade-mock')
  async downgradeMock(@CurrentUser() user) {
    return this.usersService.downgradeToFreeMock(user.id);
  }
}
