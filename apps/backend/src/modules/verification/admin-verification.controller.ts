import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { ListVerificationsDto } from './dto/list-verifications.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationService } from './services/verification.service';
import { AdminVerification } from './verification.types';

@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  async listVerifications(
    @Query() query: ListVerificationsDto,
  ): Promise<PaginatedResult<AdminVerification>> {
    return this.verificationService.listVerifications(query);
  }

  @Get('download')
  async downloadEvidence(
    @Query('ref') ref: string,
    @Query('expires') expiresStr: string,
    @Query('token') token: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const expires = Number(expiresStr);
    const file = await this.verificationService.downloadEvidence(ref, expires, token, admin);

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(file.buffer);
  }

  @Get(':verificationId')
  async getVerification(
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminVerification> {
    return this.verificationService.getVerificationDetail(verificationId, admin);
  }

  @Patch(':verificationId')
  async reviewVerification(
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @Body() body: ReviewVerificationDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminVerification> {
    return this.verificationService.reviewVerification(verificationId, body, admin);
  }
}

