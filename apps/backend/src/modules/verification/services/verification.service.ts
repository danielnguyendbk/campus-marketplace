import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../../common/interfaces/api-response.interface';
import { PostgresService } from '../../../database/postgres.service';
import { ListVerificationsDto } from '../dto/list-verifications.dto';
import { ReviewVerificationDto } from '../dto/review-verification.dto';
import { SubmitEvidenceDto } from '../dto/submit-evidence.dto';
import { EvidenceRepository } from '../repositories/evidence.repository';
import {
  AdminVerification,
  UploadedEvidenceFile,
  VerificationState,
} from '../verification.types';
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

  async listVerifications(
    query: ListVerificationsDto,
  ): Promise<PaginatedResult<AdminVerification>> {
    const rows = await this.evidenceRepository.listVerifications({
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
    const total = await this.evidenceRepository.countVerifications(query.status);

    const data = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        userId: row.user_id,
        status: row.verification_status,
        schoolEmail: row.school_email,
        displayName: row.display_name,
        school: row.school ?? null,
        studentCode: row.student_code ?? null,
        cardImageUrl: await this.storageService.getPresignedDownloadUrl(row.card_image_ref),
        submittedAt: new Date(row.submitted_at).toISOString(),
        reason: row.reason ?? null,
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
      })),
    );

    const totalPages = Math.ceil(total / query.limit) || (total === 0 ? 0 : 1);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async getVerificationDetail(
    verificationId: string,
    admin: AuthenticatedUser,
  ): Promise<AdminVerification> {
    const row = await this.evidenceRepository.getVerificationDetailById(verificationId);
    if (!row) {
      throw new NotFoundException({
        code: 'VERIFICATION_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ xác minh.',
      });
    }

    // Audit log: Admin accessed sensitive student evidence
    await this.evidenceRepository.recordAuditLog(
      admin.id,
      'VIEW_EVIDENCE',
      'student_evidences',
      verificationId,
      { viewedAt: new Date().toISOString() },
    );

    return {
      id: row.id,
      userId: row.user_id,
      status: row.verification_status,
      schoolEmail: row.school_email,
      displayName: row.display_name,
      school: row.school ?? null,
      studentCode: row.student_code ?? null,
      cardImageUrl: await this.storageService.getPresignedDownloadUrl(row.card_image_ref),
      submittedAt: new Date(row.submitted_at).toISOString(),
      reason: row.reason ?? null,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    };
  }

  async reviewVerification(
    verificationId: string,
    dto: ReviewVerificationDto,
    admin: AuthenticatedUser,
  ): Promise<AdminVerification> {
    const row = await this.evidenceRepository.getVerificationDetailById(verificationId);
    if (!row) {
      throw new NotFoundException({
        code: 'VERIFICATION_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ xác minh.',
      });
    }

    if (dto.decision === 'REJECTED' && (!dto.reason || !dto.reason.trim())) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Lý do từ chối là bắt buộc khi từ chối hồ sơ.',
        details: [{ field: 'reason', message: 'Lý do từ chối là bắt buộc khi từ chối hồ sơ.' }],
      });
    }

    const trimmedReason = dto.reason?.trim();

    await this.postgresService.withTransaction(async (client) => {
      await this.evidenceRepository.updateReviewStatus(
        {
          verificationId,
          userId: row.user_id,
          adminId: admin.id,
          decision: dto.decision,
          reason: trimmedReason,
        },
        client,
      );

      await this.evidenceRepository.recordAuditLog(
        admin.id,
        dto.decision === 'APPROVED' ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
        'users',
        row.user_id,
        {
          verificationId,
          decision: dto.decision,
          reason: trimmedReason ?? null,
        },
        client,
      );

      const notificationTitle =
        dto.decision === 'APPROVED'
          ? 'Xác minh tài khoản thành công'
          : 'Hồ sơ xác minh bị từ chối';
      const notificationContent =
        dto.decision === 'APPROVED'
          ? 'Hồ sơ sinh viên của bạn đã được phê duyệt. Bạn hiện có thể đăng bài và giao dịch trên Campus Marketplace.'
          : `Hồ sơ sinh viên của bạn bị từ chối với lý do: ${trimmedReason}. Bạn có thể cập nhật thông tin và nộp lại thẻ sinh viên.`;

      await this.evidenceRepository.createNotification(
        row.user_id,
        notificationTitle,
        notificationContent,
        'VERIFICATION_RESULT',
        verificationId,
        client,
      );
    });

    const updated = (await this.evidenceRepository.getVerificationDetailById(verificationId))!;

    return {
      id: updated.id,
      userId: updated.user_id,
      status: updated.verification_status,
      schoolEmail: updated.school_email,
      displayName: updated.display_name,
      school: updated.school ?? null,
      studentCode: updated.student_code ?? null,
      cardImageUrl: await this.storageService.getPresignedDownloadUrl(updated.card_image_ref),
      submittedAt: new Date(updated.submitted_at).toISOString(),
      reason: updated.reason ?? null,
      reviewedAt: updated.reviewed_at ? new Date(updated.reviewed_at).toISOString() : null,
    };
  }
}
