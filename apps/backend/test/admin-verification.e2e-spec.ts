import { INestApplication, NotFoundException } from '@nestjs/common';
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
  AdminVerificationDetailRow,
  StudentEvidenceRow,
} from '../src/modules/verification/verification.types';

class InMemoryAdminEvidenceRepository {
  public evidences: StudentEvidenceRow[] = [];
  public users: Record<
    string,
    {
      school_email: string;
      display_name: string;
      school: string | null;
      student_code: string | null;
      verification_status: VerificationStatus;
    }
  > = {};
  public auditLogs: Array<{
    actor_type?: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    details?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }> = [];
  public notifications: Array<{
    recipient_id?: string;
    user_id: string;
    title: string;
    content: string;
    type: string;
    reference_id?: string;
    reference_type?: string;
    ref_id?: string;
  }> = [];

  reset() {
    this.evidences = [];
    this.users = {};
    this.auditLogs = [];
    this.notifications = [];
  }

  seedData(
    evidenceId: string,
    userId: string,
    email: string,
    displayName: string,
    status: VerificationStatus = 'PENDING',
  ) {
    this.users[userId] = {
      school_email: email,
      display_name: displayName,
      school: 'PTIT HCM',
      student_code: 'B21DCCN001',
      verification_status: status,
    };
    this.evidences.push({
      id: evidenceId,
      user_id: userId,
      card_image_ref: `evidence/${userId}/card.png`,
      submitted_at: new Date('2026-11-17T08:00:00.000Z'),
      reviewed_by: null,
      reviewed_at: null,
      reason: null,
    });
  }

  async listVerifications(params: {
    page: number;
    limit: number;
    status?: VerificationStatus;
  }): Promise<AdminVerificationDetailRow[]> {
    let rows = this.evidences.map((e) => {
      const u = this.users[e.user_id];
      return {
        id: e.id,
        user_id: e.user_id,
        card_image_ref: e.card_image_ref,
        submitted_at: e.submitted_at,
        reviewed_by: e.reviewed_by ?? null,
        reviewed_at: e.reviewed_at ?? null,
        reason: e.reason ?? null,
        school_email: u?.school_email ?? 'user@ptithcm.edu.vn',
        display_name: u?.display_name ?? 'User',
        school: u?.school ?? null,
        student_code: u?.student_code ?? null,
        verification_status: u?.verification_status ?? 'PENDING',
      };
    });

    if (params.status) {
      rows = rows.filter((r) => r.verification_status === params.status);
    }

    const offset = (params.page - 1) * params.limit;
    return rows.slice(offset, offset + params.limit);
  }

  async countVerifications(status?: VerificationStatus): Promise<number> {
    if (!status) return this.evidences.length;
    return this.evidences.filter(
      (e) => this.users[e.user_id]?.verification_status === status,
    ).length;
  }

  async getVerificationDetailById(
    verificationId: string,
  ): Promise<AdminVerificationDetailRow | null> {
    const evidence = this.evidences.find((e) => e.id === verificationId);
    if (!evidence) return null;
    const user = this.users[evidence.user_id];
    return {
      id: evidence.id,
      user_id: evidence.user_id,
      card_image_ref: evidence.card_image_ref,
      submitted_at: evidence.submitted_at,
      reviewed_by: evidence.reviewed_by ?? null,
      reviewed_at: evidence.reviewed_at ?? null,
      reason: evidence.reason ?? null,
      school_email: user?.school_email ?? 'user@ptithcm.edu.vn',
      display_name: user?.display_name ?? 'User',
      school: user?.school ?? null,
      student_code: user?.student_code ?? null,
      verification_status: user?.verification_status ?? 'PENDING',
    };
  }

  async updateReviewStatus(params: {
    verificationId: string;
    userId: string;
    adminId: string;
    decision: 'APPROVED' | 'REJECTED';
    reason?: string;
  }): Promise<void> {
    const evidence = this.evidences.find((e) => e.id === params.verificationId);
    if (evidence) {
      evidence.reviewed_by = params.adminId;
      evidence.reviewed_at = new Date();
      evidence.reason = params.decision === 'REJECTED' ? params.reason ?? null : null;
    }
    const user = this.users[params.userId];
    if (user) {
      user.verification_status = params.decision;
    }
  }

  async findByCardImageRef(cardImageRef: string): Promise<StudentEvidenceRow | null> {
    const evidence = this.evidences.find((e) => e.card_image_ref === cardImageRef);
    if (!evidence) return null;
    return {
      id: evidence.id,
      user_id: evidence.user_id,
      card_image_ref: evidence.card_image_ref,
      submitted_at: evidence.submitted_at,
      reviewed_by: evidence.reviewed_by ?? null,
      reviewed_at: evidence.reviewed_at ?? null,
      reason: evidence.reason ?? null,
    };
  }

  async recordAuditLog(
    actorId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>,
    _client?: unknown,
    actorType: 'USER' | 'SYSTEM' = 'USER',
  ): Promise<void> {
    this.auditLogs.push({
      actor_type: actorType,
      actor_id: actorId ?? '',
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      payload: details,
    });
  }

  async createNotification(
    recipientId: string,
    title: string,
    content: string,
    type: string,
    referenceId?: string,
    _client?: unknown,
    referenceType?: string,
  ): Promise<void> {
    this.notifications.push({
      recipient_id: recipientId,
      user_id: recipientId,
      title,
      content,
      type,
      reference_id: referenceId,
      ref_id: referenceId,
      reference_type: referenceType ?? 'student_evidences',
    });
  }
}

describe('Admin Verification Flow (e2e) — CMP-8 / OpenAPI v1.2 Contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const adminEvidenceRepo = new InMemoryAdminEvidenceRepository();

  const testAuthConfig: AuthConfig = {
    jwtSecret: 'test-admin-jwt-secret-at-least-32-characters-long!!',
    jwtExpiresInSeconds: 3600,
    otpHashSecret: 'test-admin-otp-hash-secret-32-chars-long!!',
    otpTicketSecret: 'test-admin-otp-ticket-secret-32-chars!!',
    otpTtlSeconds: 600,
    otpMaxAttempts: 5,
    otpResendCooldownSeconds: 60,
    otpMaxPerHour: 5,
    allowedSchoolDomains: ['ptithcm.edu.vn'],
    bcryptSaltRounds: 4,
  };

  const createToken = (role: 'USER' | 'ADMIN' = 'ADMIN', userId: string = randomUUID()): string => {
    return jwtService.sign({
      sub: userId,
      email: `${role.toLowerCase()}@ptithcm.edu.vn`,
      role,
      verificationStatus: 'APPROVED',
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
      .useValue(adminEvidenceRepo)
      .overrideProvider(PostgresService)
      .useValue({
        withTransaction: jest.fn().mockImplementation(async (cb) => cb({} as never)),
        query: jest.fn().mockResolvedValue({ rows: [] }),
      })
      .overrideProvider(StorageService)
      .useValue({
        uploadPrivate: jest.fn().mockResolvedValue({ ref: 'evidence/test-user/card.png' }),
        getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/download/card.png'),
        verifyDownloadSignature: jest.fn().mockImplementation((_ref, _expires, token) => {
          if (token === 'expired-token') return { valid: false, reason: 'EXPIRED' };
          if (token === 'invalid-token') return { valid: false, reason: 'INVALID_SIGNATURE' };
          return { valid: true };
        }),
        getPrivateFile: jest.fn().mockImplementation(async (ref: string) => {
          if (ref.includes('non-existent')) {
            throw new NotFoundException({
              code: 'FILE_NOT_FOUND',
              message: 'Tệp minh chứng không tồn tại hoặc đã bị xóa.',
            });
          }
          return {
            buffer: Buffer.from('fake-card-image-bytes'),
            mimetype: 'image/png',
            filename: 'card.png',
          };
        }),
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
    adminEvidenceRepo.reset();
  });

  describe('GET /api/v1/admin/verifications', () => {
    it('returns 401 UNAUTHORIZED when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/verifications');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 FORBIDDEN when user has role USER (not ADMIN)', async () => {
      const userToken = createToken('USER');

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/verifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 with paginated verification list for ADMIN', async () => {
      const adminToken = createToken('ADMIN');
      adminEvidenceRepo.seedData(
        'evi-11111111-1111-1111-1111-111111111111',
        'user-11111111-1111-1111-1111-111111111111',
        'student1@ptithcm.edu.vn',
        'Sinh vien 1',
        'PENDING',
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/verifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('evi-11111111-1111-1111-1111-111111111111');
      expect(res.body.data[0].cardImageUrl).toBe('https://storage.example.com/download/card.png');
      expect(res.body.data[0].status).toBe('PENDING');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/admin/verifications/{verificationId}', () => {
    it('returns 403 FORBIDDEN for regular USER', async () => {
      const userToken = createToken('USER');
      const validUuid = '11111111-1111-1111-1111-111111111111';

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/${validUuid}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 when verificationId does not exist', async () => {
      const adminToken = createToken('ADMIN');
      const notFoundUuid = '99999999-9999-9999-9999-999999999999';

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/${notFoundUuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('VERIFICATION_NOT_FOUND');
    });

    it('returns 200 with detail and records audit log for sensitive access', async () => {
      const adminId = 'admin-uuid-123';
      const adminToken = createToken('ADMIN', adminId);
      const evidenceId = '22222222-2222-2222-2222-222222222222';
      const userId = '33333333-3333-3333-3333-333333333333';

      adminEvidenceRepo.seedData(evidenceId, userId, 'student2@ptithcm.edu.vn', 'Sinh vien 2');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/${evidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(evidenceId);
      expect(res.body.data.cardImageUrl).toBe('https://storage.example.com/download/card.png');

      // Verify Audit Log was recorded
      expect(adminEvidenceRepo.auditLogs).toHaveLength(1);
      expect(adminEvidenceRepo.auditLogs[0].action).toBe('VIEW_EVIDENCE');
      expect(adminEvidenceRepo.auditLogs[0].actor_id).toBe(adminId);
      expect(adminEvidenceRepo.auditLogs[0].target_id).toBe(evidenceId);
    });
  });

  describe('PATCH /api/v1/admin/verifications/{verificationId}', () => {
    const evidenceId = '44444444-4444-4444-4444-444444444444';
    const userId = '55555555-5555-5555-5555-555555555555';

    beforeEach(() => {
      adminEvidenceRepo.seedData(evidenceId, userId, 'student3@ptithcm.edu.vn', 'Sinh vien 3');
    });

    it('returns 400 when REJECTED without reason', async () => {
      const adminToken = createToken('ADMIN');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/verifications/${evidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECTED',
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('approves verification successfully (200), updates user to APPROVED, records audit log & notification', async () => {
      const adminId = 'admin-reviewer-id';
      const adminToken = createToken('ADMIN', adminId);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/verifications/${evidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');

      // Verify user in repository is now APPROVED
      expect(adminEvidenceRepo.users[userId].verification_status).toBe('APPROVED');

      // Verify audit log
      const audit = adminEvidenceRepo.auditLogs.find((a) => a.action === 'APPROVE_VERIFICATION');
      expect(audit).toBeDefined();
      expect(audit?.actor_id).toBe(adminId);
      expect(audit?.target_id).toBe(userId);
      expect(audit?.actor_type).toBe('USER');
      expect(audit?.details).toBeDefined();

      // Verify in-app notification
      expect(adminEvidenceRepo.notifications).toHaveLength(1);
      expect(adminEvidenceRepo.notifications[0].user_id).toBe(userId);
      expect(adminEvidenceRepo.notifications[0].recipient_id).toBe(userId);
      expect(adminEvidenceRepo.notifications[0].reference_id).toBe(evidenceId);
      expect(adminEvidenceRepo.notifications[0].type).toBe('VERIFICATION_RESULT');
    });

    it('rejects verification with reason, updates user to REJECTED, records audit log', async () => {
      const adminId = 'admin-reviewer-id';
      const adminToken = createToken('ADMIN', adminId);
      const rejectReason = 'Ảnh thẻ bị mờ, không khớp thông tin sinh viên.';

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/verifications/${evidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECTED',
          reason: rejectReason,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.reason).toBe(rejectReason);

      // Verify user in repository is now REJECTED
      expect(adminEvidenceRepo.users[userId].verification_status).toBe('REJECTED');

      // Verify audit log
      const audit = adminEvidenceRepo.auditLogs.find((a) => a.action === 'REJECT_VERIFICATION');
      expect(audit).toBeDefined();
      expect(audit?.payload).toEqual(expect.objectContaining({ reason: rejectReason }));

      // Verify notification
      expect(adminEvidenceRepo.notifications).toHaveLength(1);
      expect(adminEvidenceRepo.notifications[0].content).toContain(rejectReason);
    });
  });

  describe('GET /api/v1/admin/verifications/download', () => {
    const validRef = 'evidence/test-user/card.png';
    const futureExpires = String(Date.now() + 600000);
    const validToken = 'valid-token';

    it('returns 401 UNAUTHORIZED when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=${validRef}&expires=${futureExpires}&token=${validToken}`);

      expect(res.status).toBe(401);
    });

    it('returns 403 FORBIDDEN when accessed by non-ADMIN user', async () => {
      const userToken = createToken('USER');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=${validRef}&expires=${futureExpires}&token=${validToken}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 400 VALIDATION_FAILED when query parameters are missing', async () => {
      const adminToken = createToken('ADMIN');

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/verifications/download')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 403 LINK_EXPIRED when download link has expired', async () => {
      const adminToken = createToken('ADMIN');
      const pastExpires = String(Date.now() - 10000);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=${validRef}&expires=${pastExpires}&token=expired-token`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('LINK_EXPIRED');
    });

    it('returns 403 INVALID_SIGNATURE when token is invalid or tampered', async () => {
      const adminToken = createToken('ADMIN');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=${validRef}&expires=${futureExpires}&token=invalid-token`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('returns 404 FILE_NOT_FOUND when file does not exist', async () => {
      const adminToken = createToken('ADMIN');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=evidence/test-user/non-existent.png&expires=${futureExpires}&token=${validToken}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('returns 200 with raw file binary and private no-cache headers when valid ADMIN calls', async () => {
      const adminId = 'admin-download-auditor';
      const adminToken = createToken('ADMIN', adminId);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/verifications/download?ref=${validRef}&expires=${futureExpires}&token=${validToken}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toBe('private, no-cache, no-store, must-revalidate');
      expect(res.headers['pragma']).toBe('no-cache');
      expect(res.body).toEqual(Buffer.from('fake-card-image-bytes'));

      // Check audit log recorded for DOWNLOAD_EVIDENCE
      const audit = adminEvidenceRepo.auditLogs.find(
        (a) =>
          a.action === 'VIEW_EVIDENCE' &&
          (a.payload as Record<string, unknown>)?.action === 'DOWNLOAD_EVIDENCE',
      );
      expect(audit).toBeDefined();
      expect(audit?.actor_id).toBe(adminId);
    });
  });
});
