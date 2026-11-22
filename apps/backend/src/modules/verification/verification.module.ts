import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { AdminVerificationController } from './admin-verification.controller';
import { EvidenceRepository } from './repositories/evidence.repository';
import { StorageService } from './services/storage.service';
import { VerificationService } from './services/verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports: [AuthModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [EvidenceRepository, StorageService, VerificationService, RolesGuard],
  exports: [VerificationService, EvidenceRepository, StorageService],
})
export class VerificationModule {}
