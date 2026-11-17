import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { PostgresService } from '../../../database/postgres.service';
import { SubmitEvidenceDto } from '../dto/submit-evidence.dto';
import { EvidenceRepository } from '../repositories/evidence.repository';
import { UploadedEvidenceFile } from '../verification.types';
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

  const mockDto: SubmitEvidenceDto = {
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    major: 'Công nghệ thông tin',
    className: 'D21CQCN01-N',
    studentCode: 'N21DCCN001',
    cohort: '2021-2026',
    province: 'TP. Hồ Chí Minh',
  };

  const mockFile: UploadedEvidenceFile = {
    buffer: Buffer.from('fake-card-image'),
    originalname: 'the-sinh-vien.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 500, // 500 KB
  };

  beforeEach(() => {
    evidenceRepo = {
      createEvidence: jest.fn(),
      getLatestByUserId: jest.fn(),
      updateUserStudentInfo: jest.fn(),
      getUserVerificationStatus: jest.fn(),
    } as unknown as jest.Mocked<EvidenceRepository>;

    storageService = {
      uploadPrivate: jest.fn().mockResolvedValue({ ref: 'evidence/user-uuid-1/card.jpg' }),
      getPresignedDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    const mockClient = {} as PoolClient;
    postgresService = {
      withTransaction: jest.fn().mockImplementation(async (cb) => cb(mockClient)),
    } as unknown as jest.Mocked<PostgresService>;

    service = new VerificationService(evidenceRepo, storageService, postgresService);
  });

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
