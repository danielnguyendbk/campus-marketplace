import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { PostgresService } from '../../../database/postgres.service';
import { SubmitEvidenceDto } from '../dto/submit-evidence.dto';
import { EvidenceRepository } from '../repositories/evidence.repository';
import {
  AdminVerificationDetailRow,
  UploadedEvidenceFile,
} from '../verification.types';
import { StorageService } from './storage.service';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let evidenceRepo: jest.Mocked<EvidenceRepository>;
  let storageService: jest.Mocked<StorageService>;
  let postgresService: jest.Mocked<PostgresService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    schoolEmail: 'student@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'PENDING',
  };

  const mockAdmin: AuthenticatedUser = {
    id: 'admin-uuid-1',
    schoolEmail: 'admin@ptithcm.edu.vn',
    role: 'ADMIN',
    verificationStatus: 'APPROVED',
  };

  const mockDto: SubmitEvidenceDto = {
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    studentCode: 'N21DCCN001',
    major: 'Công nghệ thông tin',
    className: 'D21CQCN01-N',
    cohort: '2021-2026',
    province: 'TP. Hồ Chí Minh',
  };

  const mockFile: UploadedEvidenceFile = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'student_card.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  };

  const mockDetailRow: AdminVerificationDetailRow = {
    id: 'evi-uuid-1',
    user_id: 'user-uuid-1',
    card_image_ref: 'evidence/user-uuid-1/card.jpg',
    submitted_at: new Date('2026-11-17T08:00:00.000Z'),
    reviewed_by: null,
    reviewed_at: null,
    reason: null,
    school_email: 'student@ptithcm.edu.vn',
    display_name: 'Nguyen Van A',
    school: 'PTIT',
    student_code: 'B21DCCN001',
    verification_status: 'PENDING',
  };

  beforeEach(() => {
    evidenceRepo = {
      createEvidence: jest.fn(),
      getLatestByUserId: jest.fn(),
      updateUserStudentInfo: jest.fn(),
      getUserVerificationStatus: jest.fn(),
      listVerifications: jest.fn(),
      countVerifications: jest.fn(),
      getVerificationDetailById: jest.fn(),
      updateReviewStatus: jest.fn(),
      findByCardImageRef: jest.fn().mockResolvedValue(null),
      recordAuditLog: jest.fn(),
      createNotification: jest.fn(),
    } as unknown as jest.Mocked<EvidenceRepository>;

    storageService = {
      uploadPrivate: jest.fn().mockResolvedValue({ ref: 'evidence/user-uuid-1/card.jpg' }),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/download/card.jpg'),
      verifyDownloadSignature: jest.fn(),
      getPrivateFile: jest.fn(),
      deleteFile: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    const mockClient = {} as PoolClient;
    postgresService = {
      withTransaction: jest.fn().mockImplementation(async (cb) => cb(mockClient)),
    } as unknown as jest.Mocked<PostgresService>;

    service = new VerificationService(evidenceRepo, storageService, postgresService);
  });

  describe('submitEvidence', () => {
    it('should submit evidence successfully and return safe VerificationState', async () => {
      const mockSubmittedAt = new Date('2026-11-17T09:00:00.000Z');
      evidenceRepo.createEvidence.mockResolvedValueOnce({
        id: 'evi-1',
        user_id: mockUser.id,
        card_image_ref: 'evidence/user-uuid-1/card.jpg',
        submitted_at: mockSubmittedAt,
        reason: null,
      });

      const result = await service.submitEvidence(mockUser, mockDto, mockFile);

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.reason).toBeNull();
      expect(result.submittedAt).toBe(mockSubmittedAt.toISOString());

      // Security Verification: MUST NOT expose card_image_ref
      const exposedFields = result as unknown as Record<string, unknown>;
      expect(exposedFields.card_image_ref).toBeUndefined();
      expect(exposedFields.cardImageRef).toBeUndefined();
      expect(exposedFields.cardImageUrl).toBeUndefined();

      expect(storageService.uploadPrivate).toHaveBeenCalled();
      expect(evidenceRepo.updateUserStudentInfo).toHaveBeenCalledWith(mockUser.id, mockDto, expect.anything());
      expect(evidenceRepo.createEvidence).toHaveBeenCalledWith(
        mockUser.id,
        'evidence/user-uuid-1/card.jpg',
        expect.anything(),
      );
    });

    it('should reject submission if user is SUSPENDED', async () => {
      const suspendedUser: AuthenticatedUser = {
        ...mockUser,
        verificationStatus: 'SUSPENDED',
      };

      await expect(service.submitEvidence(suspendedUser, mockDto, mockFile)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject submission if user is already APPROVED', async () => {
      const approvedUser: AuthenticatedUser = {
        ...mockUser,
        verificationStatus: 'APPROVED',
      };

      await expect(service.submitEvidence(approvedUser, mockDto, mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject submission if file is missing', async () => {
      await expect(service.submitEvidence(mockUser, mockDto, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject submission if file MIME type is unsupported', async () => {
      const pdfFile = {
        ...mockFile,
        mimetype: 'application/pdf',
        originalname: 'document.pdf',
      };

      await expect(service.submitEvidence(mockUser, mockDto, pdfFile)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('should reject submission if file exceeds 10 MB limit', async () => {
      const oversizedFile = {
        ...mockFile,
        size: 11 * 1024 * 1024,
      };

      await expect(service.submitEvidence(mockUser, mockDto, oversizedFile)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });
  });

  describe('getVerificationState', () => {
    it('should retrieve current verification state for user with previous submission', async () => {
      evidenceRepo.getUserVerificationStatus.mockResolvedValueOnce('PENDING');
      evidenceRepo.getLatestByUserId.mockResolvedValueOnce({
        id: 'evi-1',
        user_id: mockUser.id,
        card_image_ref: 'evidence/user-uuid-1/card.jpg',
        submitted_at: new Date('2026-11-15T10:00:00.000Z'),
        reason: null,
      });

      const result = await service.getVerificationState(mockUser);

      expect(result.status).toBe('PENDING');
      expect(result.reason).toBeNull();
      expect(result.submittedAt).toBe('2026-11-15T10:00:00.000Z');
      expect((result as unknown as Record<string, unknown>).card_image_ref).toBeUndefined();
    });

    it('should retrieve default verification state for fresh user without previous evidence', async () => {
      evidenceRepo.getUserVerificationStatus.mockResolvedValueOnce('PENDING');
      evidenceRepo.getLatestByUserId.mockResolvedValueOnce(null);

      const result = await service.getVerificationState(mockUser);

      expect(result.status).toBe('PENDING');
      expect(result.reason).toBeNull();
      expect(result.submittedAt).toBeNull();
    });
  });

  describe('listVerifications', () => {
    it('should return paginated verifications list for Admin', async () => {
      evidenceRepo.listVerifications.mockResolvedValueOnce([mockDetailRow]);
      evidenceRepo.countVerifications.mockResolvedValueOnce(1);

      const result = await service.listVerifications({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockDetailRow.id);
      expect(result.data[0].cardImageUrl).toBe('https://storage.example.com/download/card.jpg');
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('getVerificationDetail', () => {
    it('should return verification detail with signed url and record audit log', async () => {
      evidenceRepo.getVerificationDetailById.mockResolvedValueOnce(mockDetailRow);

      const result = await service.getVerificationDetail(mockDetailRow.id, mockAdmin);

      expect(result.id).toBe(mockDetailRow.id);
      expect(result.cardImageUrl).toBe('https://storage.example.com/download/card.jpg');
      expect(evidenceRepo.recordAuditLog).toHaveBeenCalledWith(
        mockAdmin.id,
        'VIEW_EVIDENCE',
        'student_evidences',
        mockDetailRow.id,
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if verification record is not found', async () => {
      evidenceRepo.getVerificationDetailById.mockResolvedValueOnce(null);

      await expect(service.getVerificationDetail('non-existent', mockAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reviewVerification', () => {
    it('should approve verification, update user status, and create notification/audit log', async () => {
      evidenceRepo.getVerificationDetailById
        .mockResolvedValueOnce(mockDetailRow)
        .mockResolvedValueOnce({
          ...mockDetailRow,
          verification_status: 'APPROVED',
          reviewed_by: mockAdmin.id,
          reviewed_at: new Date('2026-11-17T10:00:00.000Z'),
        });

      const result = await service.reviewVerification(
        mockDetailRow.id,
        { decision: 'APPROVED' },
        mockAdmin,
      );

      expect(result.status).toBe('APPROVED');
      expect(evidenceRepo.updateReviewStatus).toHaveBeenCalledWith(
        {
          verificationId: mockDetailRow.id,
          userId: mockDetailRow.user_id,
          adminId: mockAdmin.id,
          decision: 'APPROVED',
          reason: undefined,
        },
        expect.anything(),
      );
      expect(evidenceRepo.recordAuditLog).toHaveBeenCalledWith(
        mockAdmin.id,
        'APPROVE_VERIFICATION',
        'users',
        mockDetailRow.user_id,
        expect.any(Object),
        expect.anything(),
      );
      expect(evidenceRepo.createNotification).toHaveBeenCalled();
    });

    it('should reject verification with reason', async () => {
      evidenceRepo.getVerificationDetailById
        .mockResolvedValueOnce(mockDetailRow)
        .mockResolvedValueOnce({
          ...mockDetailRow,
          verification_status: 'REJECTED',
          reason: 'Thẻ sinh viên mờ, không rõ họ tên',
          reviewed_by: mockAdmin.id,
          reviewed_at: new Date('2026-11-17T10:00:00.000Z'),
        });

      const result = await service.reviewVerification(
        mockDetailRow.id,
        { decision: 'REJECTED', reason: 'Thẻ sinh viên mờ, không rõ họ tên' },
        mockAdmin,
      );

      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe('Thẻ sinh viên mờ, không rõ họ tên');
      expect(evidenceRepo.updateReviewStatus).toHaveBeenCalledWith(
        {
          verificationId: mockDetailRow.id,
          userId: mockDetailRow.user_id,
          adminId: mockAdmin.id,
          decision: 'REJECTED',
          reason: 'Thẻ sinh viên mờ, không rõ họ tên',
        },
        expect.anything(),
      );
      expect(evidenceRepo.recordAuditLog).toHaveBeenCalledWith(
        mockAdmin.id,
        'REJECT_VERIFICATION',
        'users',
        mockDetailRow.user_id,
        expect.any(Object),
        expect.anything(),
      );
    });

    it('should throw BadRequestException if rejecting without reason', async () => {
      evidenceRepo.getVerificationDetailById.mockResolvedValueOnce(mockDetailRow);

      await expect(
        service.reviewVerification(mockDetailRow.id, { decision: 'REJECTED', reason: '' }, mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if verification not found', async () => {
      evidenceRepo.getVerificationDetailById.mockResolvedValueOnce(null);

      await expect(
        service.reviewVerification('non-existent', { decision: 'APPROVED' }, mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('downloadEvidence', () => {
    const ref = 'evidence/user-uuid-1/card.jpg';
    const expires = Date.now() + 600000;
    const token = 'valid-token';

    it('should throw BadRequestException if missing parameters', async () => {
      await expect(service.downloadEvidence('', expires, token, mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downloadEvidence(ref, 0, token, mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downloadEvidence(ref, expires, '', mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if token is expired', async () => {
      storageService.verifyDownloadSignature.mockReturnValueOnce({
        valid: false,
        reason: 'EXPIRED',
      });

      await expect(service.downloadEvidence(ref, expires, token, mockAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if signature is invalid', async () => {
      storageService.verifyDownloadSignature.mockReturnValueOnce({
        valid: false,
        reason: 'INVALID_SIGNATURE',
      });

      await expect(service.downloadEvidence(ref, expires, token, mockAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should retrieve private file and record audit log on success', async () => {
      storageService.verifyDownloadSignature.mockReturnValueOnce({ valid: true });
      const mockFileResult = {
        buffer: Buffer.from('card-content'),
        mimetype: 'image/jpeg',
        filename: 'card.jpg',
      };
      storageService.getPrivateFile.mockResolvedValueOnce(mockFileResult);

      const result = await service.downloadEvidence(ref, expires, token, mockAdmin);

      expect(result).toEqual(mockFileResult);
      expect(storageService.verifyDownloadSignature).toHaveBeenCalledWith(ref, expires, token);
      expect(storageService.getPrivateFile).toHaveBeenCalledWith(ref);
      expect(evidenceRepo.recordAuditLog).toHaveBeenCalledWith(
        mockAdmin.id,
        'VIEW_EVIDENCE',
        'student_evidences',
        ref,
        expect.objectContaining({
          action: 'DOWNLOAD_EVIDENCE',
          ref,
        }),
      );
    });
  });
});
