import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { VerificationService } from './services/verification.service';
import { VerificationController } from './verification.controller';
import { UploadedEvidenceFile } from './verification.types';

describe('VerificationController', () => {
  let controller: VerificationController;
  let service: jest.Mocked<VerificationService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    schoolEmail: 'student@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'PENDING',
  };

  beforeEach(async () => {
    service = {
      submitEvidence: jest.fn(),
      getVerificationState: jest.fn(),
    } as unknown as jest.Mocked<VerificationService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VerificationController>(VerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call verificationService.submitEvidence on submitEvidence', async () => {
    const mockDto: SubmitEvidenceDto = {
      school: 'PTIT',
      studentCode: 'N21DCCN001',
    };
    const mockFile: UploadedEvidenceFile = {
      buffer: Buffer.from('card'),
      originalname: 'card.png',
      mimetype: 'image/png',
      size: 100,
    };
    const expectedResult = {
      status: 'PENDING' as const,
      reason: null,
      submittedAt: '2026-11-17T09:00:00.000Z',
    };

    service.submitEvidence.mockResolvedValueOnce(expectedResult);

    const result = await controller.submitEvidence(mockUser, mockDto, mockFile);
    expect(result).toEqual(expectedResult);
    expect(service.submitEvidence).toHaveBeenCalledWith(mockUser, mockDto, mockFile);
  });

  it('should call verificationService.getVerificationState on getMyVerification', async () => {
    const expectedResult = {
      status: 'PENDING' as const,
      reason: null,
      submittedAt: '2026-11-17T09:00:00.000Z',
    };

    service.getVerificationState.mockResolvedValueOnce(expectedResult);

    const result = await controller.getMyVerification(mockUser);
    expect(result).toEqual(expectedResult);
    expect(service.getVerificationState).toHaveBeenCalledWith(mockUser);
  });
});
