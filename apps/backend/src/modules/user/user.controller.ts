import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { UserService } from './user.service';
import { MeProfileDto, PreferenceDto } from './user.types';

@Controller('me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeProfileDto> {
    return this.userService.getProfile(user.id);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async patchMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeProfileDto> {
    return this.userService.updateProfile(user.id, dto);
  }

  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreferenceDto> {
    return this.userService.getPreferences(user.id);
  }

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async setPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<PreferenceDto> {
    return this.userService.updatePreferences(user.id, dto);
  }
}

