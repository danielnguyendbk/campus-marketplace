import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { VerificationService } from './services/verification.service';
import { UploadedEvidenceFile, VerificationState } from './verification.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('me/evidence')
  @UseInterceptors(
    FileInterceptor('cardImage', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async submitEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitEvidenceDto,
    @UploadedFile() file?: UploadedEvidenceFile,
  ): Promise<VerificationState> {
    return this.verificationService.submitEvidence(user, dto, file);
  }

  @Get('me/verification')
  async getMyVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerificationState> {
    return this.verificationService.getVerificationState(user);
  }
}
