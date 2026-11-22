import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AuthConfig } from '../src/config/env.config';
import { DatabaseModule } from '../src/database/database.module';
import { PostgresService } from '../src/database/postgres.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ACCESS_TOKEN_JWT, AUTH_CONFIG, VerificationStatus } from '../src/modules/auth/auth.types';
import { MailService } from '../src/modules/auth/mail/mail.service';
import { OtpRepository } from '../src/modules/auth/repositories/otp.repository';
import { UserRepository } from '../src/modules/auth/repositories/user.repository';
import { EvidenceRepository } from '../src/modules/verification/repositories/evidence.repository';
import { StorageService } from '../src/modules/verification/services/storage.service';
import { VerificationModule } from '../src/modules/verification/verification.module';
import {
  StudentEvidenceRow,
  SubmitEvidenceData,
} from '../src/modules/verification/verification.types';

class InMemoryEvidenceRepository {
  public evidences: StudentEvidenceRow[] = [];
  public userStatus: Record<string, VerificationStatus> = {};
  public userStudentInfo: Record<string, SubmitEvidenceData> = {};

  async createEvidence(userId: string, cardImageRef: string): Promise<StudentEvidenceRow> {
    const row: StudentEvidenceRow = {
      id: randomUUID(),
      user_id: userId,
      card_image_ref: cardImageRef,
      submitted_at: new Date(),
      reviewed_by: null,
      reviewed_at: null,
      reason: null,
    };
    this.evidences.push(row);
    return row;
  }

  async getLatestByUserId(userId: string): Promise<StudentEvidenceRow | null> {
    const matching = this.evidences.filter((e) => e.user_id === userId);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }

  async updateUserStudentInfo(userId: string, data: SubmitEvidenceData): Promise<void> {
    this.userStudentInfo[userId] = data;
    this.userStatus[userId] = 'PENDING';
  }

  async getUserVerificationStatus(userId: string): Promise<VerificationStatus | null> {
    return this.userStatus[userId] ?? 'PENDING';
  }

  reset() {
    this.evidences = [];
    this.userStatus = {};
    this.userStudentInfo = {};
  }
}

describe('Student Verification Flow (e2e) — CMP-7 / OpenAPI v1.2 Contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const evidenceRepo = new InMemoryEvidenceRepository();

  const testAuthConfig: AuthConfig = {
    jwtSecret: 'e2e-jwt-secret-verification-tests-32chars!!',
    jwtExpiresInSeconds: 3600,
    otpHashSecret: 'e2e-otp-hash-secret-32-chars-long!!',
    otpTicketSecret: 'e2e-otp-ticket-secret-32-chars!!',
    otpTtlSeconds: 600,
    otpMaxAttempts: 5,
    otpResendCooldownSeconds: 60,
    otpMaxPerHour: 5,
    allowedSchoolDomains: ['edu.vn'],
    bcryptSaltRounds: 4,
  };

  const createAccessToken = (
    userId = 'user-uuid-test-1',
    email = 'student@ptithcm.edu.vn',
    verificationStatus: VerificationStatus = 'PENDING',
    role: 'USER' | 'ADMIN' = 'USER',
  ): string => {
    return jwtService.sign({
      sub: userId,
      email,
      role,
      verificationStatus,
      typ: 'access',
    });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AuthModule, VerificationModule],
    })
      .overrideProvider(AUTH_CONFIG)
      .useValue(testAuthConfig)
      .overrideProvider(OtpRepository)
      .useValue({})
      .overrideProvider(UserRepository)
      .useValue({})
      .overrideProvider(MailService)
      .useValue({})
      .overrideProvider(EvidenceRepository)
      .useValue(evidenceRepo)
      .overrideProvider(PostgresService)
      .useValue({
        withTransaction: jest.fn().mockImplementation(async (cb) => cb(null as never)),
        query: jest.fn().mockResolvedValue({ rows: [] }),
      })
      .overrideProvider(StorageService)
      .useValue({
        uploadPrivate: jest.fn().mockResolvedValue({ ref: 'evidence/test-user/card.png' }),
        getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/download'),
        deleteFile: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    jwtService = moduleFixture.get<JwtService>(ACCESS_TOKEN_JWT);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    evidenceRepo.reset();
  });

  describe('GET /api/v1/me/verification', () => {
    it('returns 401 UNAUTHORIZED when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/me/verification').expect(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns default PENDING state without card images for fresh registered student', async () => {
      const token = createAccessToken('user-fresh-1', 'fresh@ptithcm.edu.vn', 'PENDING');

      const res = await request(app.getHttpServer())
        .get('/api/v1/me/verification')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        status: 'PENDING',
        reason: null,
        submittedAt: null,
      });

      // Strict DoD Security check: MUST NOT leak card image paths
      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('cardImage');
      expect(jsonStr).not.toContain('card_image_ref');
      expect(jsonStr).not.toContain('cardImageUrl');
    });
  });

  describe('POST /api/v1/me/evidence', () => {
    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      await request(app.getHttpServer()).post('/api/v1/me/evidence').expect(401);
    });

    it('returns 400 VALIDATION_FAILED when cardImage is missing', async () => {
      const token = createAccessToken('user-sub-1', 'student1@ptithcm.edu.vn');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .field('school', 'PTIT')
        .field('studentCode', 'B21DCCN001')
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 400 VALIDATION_FAILED when required text fields are missing', async () => {
      const token = createAccessToken('user-sub-1', 'student1@ptithcm.edu.vn');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .attach('cardImage', Buffer.from('fake-card'), 'card.png')
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toBeDefined();
    });

    it('returns 415 UNSUPPORTED_MEDIA_TYPE when file is not jpg/png', async () => {
      const token = createAccessToken('user-sub-1', 'student1@ptithcm.edu.vn');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .field('school', 'PTIT')
        .field('studentCode', 'B21DCCN001')
        .attach('cardImage', Buffer.from('plain-text-file'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(415);

      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('submits evidence successfully (201 Created), returns safe envelope, and keeps user PENDING', async () => {
      const token = createAccessToken('user-sub-1', 'student1@ptithcm.edu.vn', 'PENDING');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .field('school', 'Học viện Công nghệ Bưu chính Viễn thông')
        .field('major', 'Công nghệ thông tin')
        .field('className', 'D21CQCN01')
        .field('studentCode', 'B21DCCN001')
        .field('cohort', '2021-2026')
        .field('province', 'TP. Hồ Chí Minh')
        .attach('cardImage', Buffer.from('fake-image-bytes'), {
          filename: 'card.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.reason).toBeNull();
      expect(typeof res.body.data.submittedAt).toBe('string');
      expect(typeof res.body.timestamp).toBe('string');

      // Strict envelope keys check
      expect(Object.keys(res.body.data).sort()).toEqual(['reason', 'status', 'submittedAt']);

      // Check subsequent GET /me/verification reflects new submitted state
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/me/verification')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getRes.body.data.status).toBe('PENDING');
      expect(getRes.body.data.submittedAt).toBe(res.body.data.submittedAt);
      expect(getRes.body.data.reason).toBeNull();
    });

    it('allows REJECTED user to resubmit evidence and sets status back to PENDING', async () => {
      const userId = 'user-rejected-1';
      evidenceRepo.userStatus[userId] = 'REJECTED';
      const token = createAccessToken(userId, 'rejected@ptithcm.edu.vn', 'REJECTED');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .field('school', 'PTIT')
        .field('studentCode', 'B21DCCN999')
        .attach('cardImage', Buffer.from('new-card-bytes'), {
          filename: 'new-card.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body.data.status).toBe('PENDING');
      expect(evidenceRepo.userStatus[userId]).toBe('PENDING');
    });

    it('rejects evidence submission if user is already APPROVED', async () => {
      const token = createAccessToken('user-approved-1', 'approved@ptithcm.edu.vn', 'APPROVED');

      const res = await request(app.getHttpServer())
        .post('/api/v1/me/evidence')
        .set('Authorization', `Bearer ${token}`)
        .field('school', 'PTIT')
        .field('studentCode', 'B21DCCN888')
        .attach('cardImage', Buffer.from('card'), {
          filename: 'card.png',
          contentType: 'image/png',
        })
        .expect(400);

      expect(res.body.error.code).toBe('ALREADY_APPROVED');
    });
  });
});
