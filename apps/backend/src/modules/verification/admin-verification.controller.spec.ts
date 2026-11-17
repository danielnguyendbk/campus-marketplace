import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AdminVerificationController } from './admin-verification.controller';
import { VerificationService } from './services/verification.service';
import { AdminVerification } from './verification.types';

describe('AdminVerificationController', () => {
  let controller: AdminVerificationController;
  let verificationService: jest.Mocked<VerificationService>;

  const mockAdmin: AuthenticatedUser = {
    id: 'admin-uuid-1',
    schoolEmail: 'admin@ptithcm.edu.vn',
    role: 'ADMIN',
    verificationStatus: 'APPROVED',
  };

  const mockVerification: AdminVerification = {
    id: 'evi-uuid-1',
    userId: 'student-uuid-1',
    status: 'PENDING',
    schoolEmail: 'student@ptithcm.edu.vn',
    displayName: 'Nguyen Van A',
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    studentCode: 'B21DCCN001',
    cardImageUrl: 'https://storage.example.com/download/card.png',
    submittedAt: '2026-11-17T08:00:00.000Z',
    reason: null,
    reviewedAt: null,
  };

  beforeEach(async () => {
    verificationService = {
      listVerifications: jest.fn(),
      getVerificationDetail: jest.fn(),
      reviewVerification: jest.fn(),
    } as unknown as jest.Mocked<VerificationService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminVerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: verificationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminVerificationController>(AdminVerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listVerifications', () => {
    it('should return paginated verifications list', async () => {
      const mockResult = {
        data: [mockVerification],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };
      verificationService.listVerifications.mockResolvedValueOnce(mockResult);

      const result = await controller.listVerifications({ page: 1, limit: 20, status: 'PENDING' });
      expect(result).toEqual(mockResult);
      expect(verificationService.listVerifications).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'PENDING',
      });
    });
  });

  describe('getVerification', () => {
    it('should return verification detail with cardImageUrl', async () => {
      verificationService.getVerificationDetail.mockResolvedValueOnce(mockVerification);

      const result = await controller.getVerification('evi-uuid-1', mockAdmin);
      expect(result).toEqual(mockVerification);
      expect(verificationService.getVerificationDetail).toHaveBeenCalledWith(
        'evi-uuid-1',
        mockAdmin,
      );
    });
  });

  describe('reviewVerification', () => {
    it('should review verification and return updated verification', async () => {
      const approvedResult = {
        ...mockVerification,
        status: 'APPROVED' as const,
        reviewedAt: '2026-11-17T09:00:00.000Z',
      };
      verificationService.reviewVerification.mockResolvedValueOnce(approvedResult);

      const result = await controller.reviewVerification(
        'evi-uuid-1',
        { decision: 'APPROVED' },
        mockAdmin,
      );

      expect(result).toEqual(approvedResult);
      expect(verificationService.reviewVerification).toHaveBeenCalledWith(
        'evi-uuid-1',
        { decision: 'APPROVED' },
        mockAdmin,
      );
    });
  });
});

