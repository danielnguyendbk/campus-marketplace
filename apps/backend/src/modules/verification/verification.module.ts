import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvidenceRepository } from './repositories/evidence.repository';
import { StorageService } from './services/storage.service';
import { VerificationService } from './services/verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports: [AuthModule],
  controllers: [VerificationController],
  providers: [EvidenceRepository, StorageService, VerificationService],
  exports: [VerificationService, EvidenceRepository, StorageService],
})
export class VerificationModule {}

