import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { SubmitEvidenceDto } from '../dto/submit-evidence.dto';
import { EvidenceRepository } from '../repositories/evidence.repository';
import { UploadedEvidenceFile, VerificationState } from '../verification.types';
import { StorageService } from './storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

@Injectable()
export class VerificationService {
  constructor(
    private readonly evidenceRepository: EvidenceRepository,
    private readonly storageService: StorageService,
    private readonly postgresService: PostgresService,
  ) {}

  async submitEvidence(
    user: AuthenticatedUser,
    dto: SubmitEvidenceDto,
    file?: UploadedEvidenceFile,
  ): Promise<VerificationState> {
    if (user.verificationStatus === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản đã bị tạm khóa.',
      });
    }

    if (user.verificationStatus === 'APPROVED') {
      throw new BadRequestException({
        code: 'ALREADY_APPROVED',
        message: 'Tài khoản của bạn đã được xác minh thành công.',
      });
    }

    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Ảnh thẻ sinh viên là bắt buộc.',
        details: [{ field: 'cardImage', message: 'Ảnh thẻ sinh viên là bắt buộc.' }],
      });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Định dạng tệp không được hỗ trợ. Vui lòng tải lên ảnh định dạng JPG hoặc PNG.',
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'Kích thước tệp vượt quá giới hạn cho phép (tối đa 10 MB).',
      });
    }

    // Securely upload to private storage
    const uploadResult = await this.storageService.uploadPrivate(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      `evidence/${user.id}`,
    );

    // Save evidence & update user status atomically
    const evidence = await this.postgresService.withTransaction(async (client) => {
      await this.evidenceRepository.updateUserStudentInfo(user.id, dto, client);
      return this.evidenceRepository.createEvidence(user.id, uploadResult.ref, client);
    });

    return {
      status: 'PENDING',
      reason: null,
      submittedAt:
        evidence.submitted_at instanceof Date
          ? evidence.submitted_at.toISOString()
          : new Date().toISOString(),
    };
  }

  async getVerificationState(user: AuthenticatedUser): Promise<VerificationState> {
    const currentStatus =
      (await this.evidenceRepository.getUserVerificationStatus(user.id)) ??
      user.verificationStatus;

    const latestEvidence = await this.evidenceRepository.getLatestByUserId(user.id);

    return {
      status: currentStatus,
      reason: latestEvidence?.reason ?? null,
      submittedAt: latestEvidence?.submitted_at
        ? new Date(latestEvidence.submitted_at).toISOString()
        : null,
    };
  }
}
