import {
  Controller,
  Get,
  INestApplication,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../src/common/auth/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AuthConfig } from '../src/config/env.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AuthUser,
} from '../src/modules/auth/auth.types';
import { MailService } from '../src/modules/auth/mail/mail.service';
import {
  OtpRepository,
  OtpSendStats,
  OtpVerificationRow,
} from '../src/modules/auth/repositories/otp.repository';
import {
  UserRepository,
  UserRow,
} from '../src/modules/auth/repositories/user.repository';

@Controller('auth-test-protected')
class ProtectedProbeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  probe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

class InMemoryOtpRepository {
  public rows: OtpVerificationRow[] = [];

  reset() {
    this.rows = [];
  }

  async getSendStats(email: string): Promise<OtpSendStats> {
    const oneHourAgo = Date.now() - 3600_000;
    const matching = this.rows.filter(
      (r) => r.email === email && r.purpose === 'REGISTER',
    );
    const lastHourCount = matching.filter(
      (r) => r.created_at.getTime() > oneHourAgo,
    ).length;
    const lastSentAt =
      matching.length > 0
        ? new Date(Math.max(...matching.map((r) => r.created_at.getTime())))
        : null;
    return { lastHourCount, lastSentAt };
  }

  async expireActiveByEmail(email: string): Promise<void> {
    const now = new Date();
    for (const r of this.rows) {
      // R04: also revokes verified records whose ticket was never consumed.
      if (r.email === email && r.purpose === 'REGISTER' && r.expires_at > now) {
        r.expires_at = now;
      }
    }
  }

  async createOtp(params: {
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<OtpVerificationRow> {
    const row: OtpVerificationRow = {
      id: randomUUID(),
      email: params.email,
      code_hash: params.codeHash,
      purpose: 'REGISTER',
      expires_at: params.expiresAt,
      attempts: 0,
      verified_at: null,
      created_at: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async expireById(id: string): Promise<void> {
    const found = this.rows.find((r) => r.id === id);
    if (found) {
      found.expires_at = new Date(Date.now() - 1000);
    }
  }

  async findLatestActiveByEmail(email: string): Promise<OtpVerificationRow | null> {
    const now = new Date();
    const candidates = this.rows
      .filter(
        (r) =>
          r.email === email &&
          r.purpose === 'REGISTER' &&
          r.verified_at === null &&
          r.expires_at > now,
      )
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return candidates[0] ?? null;
  }

  async incrementAttempts(id: string, maxAttempts: number): Promise<number | null> {
    const now = new Date();
    const found = this.rows.find(
      (r) =>
        r.id === id &&
        r.verified_at === null &&
        r.expires_at > now &&
        r.attempts < maxAttempts,
    );
    if (!found) return null;
    found.attempts += 1;
    return found.attempts;
  }

  async markVerified(
    id: string,
    maxAttempts: number,
    ticketTtlSeconds: number,
  ): Promise<boolean> {
    const now = new Date();
    const found = this.rows.find(
      (r) =>
        r.id === id &&
        r.verified_at === null &&
        r.expires_at > now &&
        r.attempts < maxAttempts,
    );
    if (!found) return false;
    found.verified_at = now;
    found.expires_at = new Date(now.getTime() + ticketTtlSeconds * 1000);
    return true;
  }

  async consumeVerifiedTicket(id: string): Promise<boolean> {
    const now = new Date();
    // Check-and-set without any await: a single winner even under concurrent callers.
    const found = this.rows.find(
      (r) => r.id === id && r.verified_at !== null && r.expires_at > now,
    );
    if (!found) return false;
    found.expires_at = now;
    return true;
  }

  async findById(id: string): Promise<OtpVerificationRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }
}

class InMemoryUserRepository {
  public users: UserRow[] = [];

  reset() {
    this.users = [];
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.users.some((u) => u.school_email === email);
  }

  async findActiveByEmail(email: string): Promise<UserRow | null> {
    return (
      this.users.find((u) => u.school_email === email && !u.deleted_at) ?? null
    );
  }

  async createUser(params: {
    schoolEmail: string;
    passwordHash: string;
    displayName: string;
  }): Promise<AuthUser> {
    if (this.users.some((u) => u.school_email === params.schoolEmail)) {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
      });
    }
    const id = randomUUID();
    const row: UserRow = {
      id,
      school_email: params.schoolEmail,
      password_hash: params.passwordHash,
      display_name: params.displayName,
      role: 'USER',
      verification_status: 'PENDING',
      deleted_at: null,
    };
    this.users.push(row);
    return {
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      verificationStatus: row.verification_status,
    };
  }
}

class FakeMailService extends MailService {
  public sent: { to: string; code: string; expiresInSeconds: number }[] = [];

  reset() {
    this.sent = [];
  }

  async sendOtpEmail(params: {
    to: string;
    code: string;
    expiresInSeconds: number;
  }): Promise<void> {
    this.sent.push(params);
  }
}

describe('Auth Flow (e2e) — CMP-6 / OpenAPI v1.2 Contract', () => {
  let app: INestApplication;
  const otpRepo = new InMemoryOtpRepository();
  const userRepo = new InMemoryUserRepository();
  const fakeMail = new FakeMailService();

  const testAuthConfig: AuthConfig = {
    jwtSecret: 'e2e-jwt-secret-at-least-32-characters-long!!',
    jwtExpiresInSeconds: 3600,
    otpHashSecret: 'e2e-otp-hash-secret-at-least-32-characters!!',
    otpTicketSecret: 'e2e-otp-ticket-secret-at-least-32-characters!!',
    otpTtlSeconds: 600,
    otpMaxAttempts: 5,
    otpResendCooldownSeconds: 60,
    otpMaxPerHour: 5,
    allowedSchoolDomains: ['edu.vn'],
    bcryptSaltRounds: 4,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ProtectedProbeController],
    })
      .overrideProvider(AUTH_CONFIG)
      .useValue(testAuthConfig)
      .overrideProvider(OtpRepository)
      .useValue(otpRepo)
      .overrideProvider(UserRepository)
      .useValue(userRepo)
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  beforeEach(() => {
    otpRepo.reset();
    userRepo.reset();
    fakeMail.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes the full happy path: request-otp -> verify-otp -> register (PENDING) -> login -> authenticated probe', async () => {
    const email = '  SinhVien01@STU.PTIT.EDU.VN ';

    // 1. Request OTP
    const reqOtpRes = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email })
      .expect(200);

    expect(Object.keys(reqOtpRes.body).sort()).toEqual(
      ['data', 'success', 'timestamp'].sort(),
    );
    expect(Object.keys(reqOtpRes.body.data).sort()).toEqual(
      ['message', 'success'].sort(),
    );
    expect(reqOtpRes.body.data.success).toBe(true);
    expect(fakeMail.sent).toHaveLength(1);
    const otpCode = fakeMail.sent[0].code;
    expect(otpCode).toMatch(/^\d{6}$/);
    expect(otpRepo.rows[0].code_hash).not.toContain(otpCode);

    // 2. Verify OTP
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: otpCode })
      .expect(200);

    expect(Object.keys(verifyRes.body).sort()).toEqual(
      ['data', 'success', 'timestamp'].sort(),
    );
    expect(Object.keys(verifyRes.body.data).sort()).toEqual(
      ['expiresIn', 'otpTicket'].sort(),
    );
    expect(verifyRes.body.data.expiresIn).toBe(600);
    const otpTicket: string = verifyRes.body.data.otpTicket;

    // 3. Register account (status PENDING, role USER)
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        otpTicket,
        displayName: 'Nguyễn Văn A',
        password: 'StudentPassword123',
      })
      .expect(201);

    expect(Object.keys(registerRes.body).sort()).toEqual(
      ['data', 'success', 'timestamp'].sort(),
    );
    expect(Object.keys(registerRes.body.data).sort()).toEqual(
      ['accessToken', 'expiresIn', 'tokenType', 'user'].sort(),
    );
    expect(Object.keys(registerRes.body.data.user).sort()).toEqual(
      ['displayName', 'id', 'role', 'verificationStatus'].sort(),
    );
    expect(registerRes.body.data.tokenType).toBe('Bearer');
    expect(registerRes.body.data.expiresIn).toBe(3600);
    expect(registerRes.body.data.user).toMatchObject({
      displayName: 'Nguyễn Văn A',
      role: 'USER',
      verificationStatus: 'PENDING',
    });

    // Reusing the same otpTicket to register again returns 409 Conflict
    const replayRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        otpTicket,
        displayName: 'Nguyễn Văn A',
        password: 'StudentPassword123',
      })
      .expect(409);

    expect(Object.keys(replayRes.body)).toEqual(['error']);
    expect(replayRes.body.error.code).toBe(
      AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    );

    // 4. Requesting OTP again for an already-registered email returns generic 200 without sending mail
    const existingOtpRes = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email: 'sinhvien01@stu.ptit.edu.vn' })
      .expect(200);
    expect(existingOtpRes.body.data.success).toBe(true);
    expect(fakeMail.sent).toHaveLength(1); // still 1

    // 5. Login with valid credentials
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'SINHVIEN01@stu.ptit.edu.vn',
        password: 'StudentPassword123',
      })
      .expect(200);

    expect(Object.keys(loginRes.body.data).sort()).toEqual(
      ['accessToken', 'expiresIn', 'tokenType', 'user'].sort(),
    );
    expect(loginRes.body.data.user).toEqual(registerRes.body.data.user);

    // 6. Access protected probe with accessToken vs unauthenticated
    await request(app.getHttpServer())
      .get('/api/v1/auth-test-protected')
      .expect(401);

    const probeRes = await request(app.getHttpServer())
      .get('/api/v1/auth-test-protected')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
      .expect(200);

    expect(probeRes.body.data).toEqual({
      id: loginRes.body.data.user.id,
      schoolEmail: 'sinhvien01@stu.ptit.edu.vn',
      role: 'USER',
      verificationStatus: 'PENDING',
    });
  });

  it('enforces domain allowlist, DTO validation (additionalProperties: false), OTP attempt limit, and login errors', async () => {
    // Disallowed domain -> 400 EMAIL_DOMAIN_NOT_ALLOWED
    const badDomain = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email: 'user@gmail.com' })
      .expect(400);
    expect(badDomain.body.error.code).toBe(
      AUTH_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
    );

    // Extra field on register -> 400 VALIDATION_FAILED
    const extraField = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        otpTicket: 'ticket',
        displayName: 'SV',
        password: 'Password123',
        role: 'ADMIN',
      })
      .expect(400);
    expect(extraField.body.error.code).toBe('VALIDATION_FAILED');

    // Request OTP for attempt-limit test
    const email = 'attempt@ptit.edu.vn';
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email })
      .expect(200);

    // Cooldown violation on immediate resend -> 429 OTP_RATE_LIMITED
    const cooldownRes = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email })
      .expect(429);
    expect(cooldownRes.body.error.code).toBe(AUTH_ERROR_CODES.OTP_RATE_LIMITED);

    // 4 wrong OTP attempts -> 400 OTP_INVALID, 5th wrong attempt -> 429 OTP_ATTEMPTS_EXCEEDED
    for (let i = 1; i <= 4; i++) {
      const wrongRes = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ email, code: '000000' })
        .expect(400);
      expect(wrongRes.body.error.code).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    }

    const fifthWrong = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: '000000' })
      .expect(429);
    expect(fifthWrong.body.error.code).toBe(
      AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
    );

    // Even the real code is now rejected with 429 until a new OTP is requested
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: fakeMail.sent[0].code })
      .expect(429);

    // Invalid login -> 401 INVALID_CREDENTIALS
    const badLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@ptit.edu.vn', password: 'Password123' })
      .expect(401);
    expect(badLogin.body.error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  describe('CMP-37 — concurrency, ticket lifecycle and time/attempt boundaries', () => {
    const requestOtpFor = (email: string) =>
      request(app.getHttpServer()).post('/api/v1/auth/request-otp').send({ email });

    const verifyFor = (email: string, code: string) =>
      request(app.getHttpServer()).post('/api/v1/auth/verify-otp').send({ email, code });

    const registerWith = (otpTicket: string) =>
      request(app.getHttpServer()).post('/api/v1/auth/register').send({
        otpTicket,
        displayName: 'Sinh viên CMP37',
        password: 'StudentPassword123',
      });

    const lastCodeFor = (email: string): string => {
      const entry = [...fakeMail.sent].reverse().find((s) => s.to === email);
      if (!entry) throw new Error('No OTP email was sent for this address');
      return entry.code;
    };

    const rowsFor = (email: string) => otpRepo.rows.filter((r) => r.email === email);
    const lastRowFor = (email: string): OtpVerificationRow => {
      const rows = rowsFor(email);
      return rows[rows.length - 1];
    };

    it('EX-17B: only one of five concurrent verify-otp requests receives an otpTicket', async () => {
      const email = 'race.verify@ptit.edu.vn';
      await requestOtpFor(email).expect(200);
      const code = lastCodeFor(email);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => verifyFor(email, code)),
      );

      const accepted = responses.filter((r) => r.status === 200);
      const rejected = responses.filter((r) => r.status === 400);
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const res of rejected) {
        expect(res.body.error.code).toBe(AUTH_ERROR_CODES.OTP_INVALID);
      }
      expect(Object.keys(accepted[0].body.data).sort()).toEqual(
        ['expiresIn', 'otpTicket'].sort(),
      );
      expect(rowsFor(email).filter((r) => r.verified_at !== null)).toHaveLength(1);
    });

    it('EX-17B: only one of five concurrent register requests creates the account', async () => {
      const email = 'race.register@ptit.edu.vn';
      await requestOtpFor(email).expect(200);
      const verifyRes = await verifyFor(email, lastCodeFor(email)).expect(200);
      const otpTicket: string = verifyRes.body.data.otpTicket;

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => registerWith(otpTicket)),
      );

      const created = responses.filter((r) => r.status === 201);
      const rejected = responses.filter((r) => r.status === 400 || r.status === 409);
      expect(created).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const res of rejected) {
        expect([
          AUTH_ERROR_CODES.OTP_TICKET_INVALID,
          AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        ]).toContain(res.body.error.code);
      }
      expect(userRepo.users.filter((u) => u.school_email === email)).toHaveLength(1);
    });

    it('EX-17B: a newer request-otp revokes the previous unconsumed otpTicket', async () => {
      const email = 'ticket.revoke@ptit.edu.vn';
      await requestOtpFor(email).expect(200);
      const firstTicket: string = (
        await verifyFor(email, lastCodeFor(email)).expect(200)
      ).body.data.otpTicket;

      lastRowFor(email).created_at = new Date(Date.now() - 61_000);
      await requestOtpFor(email).expect(200);

      // No account exists yet, so this rejection proves independent ticket revocation.
      const replay = await registerWith(firstTicket).expect(400);
      expect(replay.body.error.code).toBe(AUTH_ERROR_CODES.OTP_TICKET_INVALID);
      expect(userRepo.users).toHaveLength(0);
    });

    it('EX-18B: enforces the 60s resend cooldown and revokes the replaced OTP', async () => {
      const email = 'resend.boundary@ptit.edu.vn';
      await requestOtpFor(email).expect(200);
      const firstCode = lastCodeFor(email);

      const immediate = await requestOtpFor(email).expect(429);
      expect(immediate.body.error.code).toBe(AUTH_ERROR_CODES.OTP_RATE_LIMITED);

      lastRowFor(email).created_at = new Date(Date.now() - 59_000);
      await requestOtpFor(email).expect(429);

      lastRowFor(email).created_at = new Date(Date.now() - 60_000);
      await requestOtpFor(email).expect(200);
      const secondCode = lastCodeFor(email);
      expect(secondCode).not.toBe(firstCode);

      const oldCodeRes = await verifyFor(email, firstCode).expect(400);
      expect(oldCodeRes.body.error.code).toBe(AUTH_ERROR_CODES.OTP_INVALID);

      await verifyFor(email, secondCode).expect(200);
    });

    it('EX-18B: enforces OTP_MAX_PER_HOUR=5 then allows sending once the hour window slides', async () => {
      const email = 'resend.quota@ptit.edu.vn';
      await requestOtpFor(email).expect(200);

      for (let i = 1; i < 5; i++) {
        lastRowFor(email).created_at = new Date(Date.now() - 61_000);
        await requestOtpFor(email).expect(200);
      }
      expect(rowsFor(email)).toHaveLength(5);

      lastRowFor(email).created_at = new Date(Date.now() - 61_000);
      const sixth = await requestOtpFor(email).expect(429);
      expect(sixth.body.error.code).toBe(AUTH_ERROR_CODES.OTP_RATE_LIMITED);
      expect(fakeMail.sent.filter((m) => m.to === email)).toHaveLength(5);

      for (const row of rowsFor(email)) {
        row.created_at = new Date(Date.now() - 3_700_000);
      }
      await requestOtpFor(email).expect(200);
    });

    it('EX-19A: enforces the expires_at boundary exactly', async () => {
      const cases: { email: string; offsetMs: number; expected: number }[] = [
        { email: 'expiry.before@ptit.edu.vn', offsetMs: 500, expected: 200 },
        { email: 'expiry.at@ptit.edu.vn', offsetMs: 0, expected: 400 },
        { email: 'expiry.after@ptit.edu.vn', offsetMs: -1, expected: 400 },
      ];

      for (const testCase of cases) {
        await requestOtpFor(testCase.email).expect(200);
        lastRowFor(testCase.email).expires_at = new Date(
          Date.now() + testCase.offsetMs,
        );

        const res = await verifyFor(testCase.email, lastCodeFor(testCase.email));
        expect(res.status).toBe(testCase.expected);
        if (testCase.expected === 400) {
          expect(res.body.error.code).toBe(AUTH_ERROR_CODES.OTP_INVALID);
        }
      }
    });

    it('EX-19A: enforces the five-attempt boundary exactly', async () => {
      const luckyEmail = 'attempts.correct@ptit.edu.vn';
      await requestOtpFor(luckyEmail).expect(200);
      const luckyCode = lastCodeFor(luckyEmail);
      for (let i = 0; i < 4; i++) {
        await verifyFor(luckyEmail, '000000').expect(400);
      }
      // The 5th request is still allowed because only 4 attempts were consumed.
      await verifyFor(luckyEmail, luckyCode).expect(200);

      const lockedEmail = 'attempts.exceeded@ptit.edu.vn';
      await requestOtpFor(lockedEmail).expect(200);
      const lockedCode = lastCodeFor(lockedEmail);
      for (let i = 0; i < 4; i++) {
        await verifyFor(lockedEmail, '000000').expect(400);
      }

      const fifth = await verifyFor(lockedEmail, '000000').expect(429);
      expect(fifth.body.error.code).toBe(AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED);

      const sixth = await verifyFor(lockedEmail, lockedCode).expect(429);
      expect(sixth.body.error.code).toBe(AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED);
    });
  });
});

