import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { DatabaseModule } from '../src/database/database.module';
import { PostgresService } from '../src/database/postgres.service';
import { ACCESS_TOKEN_JWT, UserRole, VerificationStatus } from '../src/modules/auth/auth.types';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { UserModule } from '../src/modules/user/user.module';

interface FakeUserRecord {
  id: string;
  school_email: string;
  display_name: string;
  phone_number: string | null;
  role: UserRole;
  verification_status: VerificationStatus;
  school: string | null;
  major: string | null;
  class_name: string | null;
  student_code: string | null;
  cohort: string | null;
  province: string | null;
  reputation_score: number | string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface FakePreferenceRecord {
  user_id: string;
  favorite_category_ids: string[];
  interest_keywords: string[];
  updated_at: Date;
}

interface FakeCategoryRecord {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

class InMemoryPostgresForUser {
  public users = new Map<string, FakeUserRecord>();
  public preferences = new Map<string, FakePreferenceRecord>();
  public categories = new Map<string, FakeCategoryRecord>();

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  seedCategory(category: FakeCategoryRecord) {
    this.categories.set(category.id, category);
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    // VerificationGuard lookup
    if (
      normalized.includes('FROM "users"') &&
      normalized.includes('WHERE "id" = $1 AND "deleted_at" IS NULL') &&
      normalized.includes('SELECT "id", "school_email"')
    ) {
      const u = this.users.get(String(params[0]));
      if (!u || u.deleted_at !== null) return { rows: [] };
      return {
        rows: [
          {
            id: u.id,
            school_email: u.school_email,
            display_name: u.display_name,
            role: u.role,
            verification_status: u.verification_status,
            reputation_score: u.reputation_score,
            province: u.province,
          },
        ],
      };
    }

    // findProfileById
    if (
      normalized.includes('FROM "users" u') &&
      normalized.includes('WHERE u."id" = $1') &&
      normalized.includes('u."deleted_at" IS NULL')
    ) {
      const u = this.users.get(String(params[0]));
      if (!u || u.deleted_at !== null) return { rows: [] };
      return {
        rows: [
          {
            id: u.id,
            school_email: u.school_email,
            display_name: u.display_name,
            phone_number: u.phone_number,
            role: u.role,
            verification_status: u.verification_status,
            school: u.school,
            major: u.major,
            class_name: u.class_name,
            student_code: u.student_code,
            cohort: u.cohort,
            province: u.province,
            reputation_score: u.reputation_score,
            created_at: u.created_at,
          },
        ],
      };
    }

    // updateProfile
    if (normalized.startsWith('UPDATE "users"')) {
      const userId = String(params[0]);
      const u = this.users.get(userId);
      if (!u || u.deleted_at !== null) return { rows: [] };

      // Parameter indexes dynamically added
      let pIdx = 1;
      if (normalized.includes('"display_name" = $')) {
        pIdx++;
        u.display_name = String(params[pIdx - 1]);
      }
      if (normalized.includes('"phone_number" = $')) {
        pIdx++;
        const pVal = params[pIdx - 1];
        u.phone_number = pVal === null ? null : String(pVal);
      }
      if (normalized.includes('"province" = $')) {
        pIdx++;
        u.province = String(params[pIdx - 1]);
      }
      u.updated_at = new Date();

      return {
        rows: [
          {
            id: u.id,
            school_email: u.school_email,
            display_name: u.display_name,
            phone_number: u.phone_number,
            role: u.role,
            verification_status: u.verification_status,
            school: u.school,
            major: u.major,
            class_name: u.class_name,
            student_code: u.student_code,
            cohort: u.cohort,
            province: u.province,
            reputation_score: u.reputation_score,
            created_at: u.created_at,
          },
        ],
      };
    }

    // findPreferences
    if (normalized.includes('FROM "user_preferences"') && normalized.includes('WHERE "user_id" = $1')) {
      const pref = this.preferences.get(String(params[0]));
      if (!pref) return { rows: [] };
      return {
        rows: [
          {
            user_id: pref.user_id,
            favorite_category_ids: pref.favorite_category_ids,
            interest_keywords: pref.interest_keywords,
            updated_at: pref.updated_at,
          },
        ],
      };
    }

    // upsertPreferences
    if (normalized.startsWith('INSERT INTO "user_preferences"')) {
      const userId = String(params[0]);
      const catIds = params[1] as string[];
      const keywords = params[2] as string[];
      const now = new Date();

      const pref: FakePreferenceRecord = {
        user_id: userId,
        favorite_category_ids: catIds,
        interest_keywords: keywords,
        updated_at: now,
      };
      this.preferences.set(userId, pref);
      return {
        rows: [
          {
            user_id: pref.user_id,
            favorite_category_ids: pref.favorite_category_ids,
            interest_keywords: pref.interest_keywords,
            updated_at: pref.updated_at,
          },
        ],
      };
    }

    // CategoriesRepository.findActiveById
    if (
      normalized.includes('FROM "categories"') &&
      normalized.includes('WHERE "id" = $1 AND "is_active" = true')
    ) {
      const catId = String(params[0]);
      const cat = this.categories.get(catId);
      if (!cat || !cat.is_active) return { rows: [] };
      return {
        rows: [
          {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            sort_order: cat.sort_order,
          },
        ],
      };
    }

    return { rows: [] };
  }
}

describe('User Profile & Preferences E2E (CMP-21 / BE-01-T04)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const fakeDb = new InMemoryPostgresForUser();

  const approvedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.approved@ptit.edu.vn',
    display_name: 'Nguyễn Văn Duyệt',
    phone_number: '0912345678',
    role: 'USER',
    verification_status: 'APPROVED',
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    major: 'Công nghệ Thông tin',
    class_name: 'D20CNTT1',
    student_code: 'B20DCCN001',
    cohort: '2020',
    province: 'Hà Nội',
    reputation_score: 5.0,
    created_at: new Date('2026-11-01T08:00:00.000Z'),
    updated_at: new Date('2026-11-01T08:00:00.000Z'),
    deleted_at: null,
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.pending@ptit.edu.vn',
    display_name: 'Trần Thị Chờ Duyệt',
    phone_number: null,
    role: 'USER',
    verification_status: 'PENDING',
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    major: 'An toàn Thông tin',
    class_name: null,
    student_code: null,
    cohort: null,
    province: null,
    reputation_score: 5.0,
    created_at: new Date('2026-11-05T08:00:00.000Z'),
    updated_at: new Date('2026-11-05T08:00:00.000Z'),
    deleted_at: null,
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.suspended@ptit.edu.vn',
    display_name: 'Lê Văn Khóa',
    phone_number: '0987654321',
    role: 'USER',
    verification_status: 'SUSPENDED',
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
    major: 'Điện tử',
    class_name: null,
    student_code: null,
    cohort: null,
    province: null,
    reputation_score: 1.0,
    created_at: new Date('2026-10-01T08:00:00.000Z'),
    updated_at: new Date('2026-10-01T08:00:00.000Z'),
    deleted_at: null,
  };

  let approvedToken: string;
  let pendingToken: string;
  let suspendedToken: string;

  beforeAll(async () => {
    fakeDb.seedUser(approvedUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(suspendedUser);

    fakeDb.seedCategory({
      id: 'TEXTBOOK',
      name: 'Sách và giáo trình',
      slug: 'textbooks',
      is_active: true,
      sort_order: 1,
    });
    fakeDb.seedCategory({
      id: 'ELECTRONICS',
      name: 'Thiết bị điện tử & Phụ kiện',
      slug: 'electronics',
      is_active: true,
      sort_order: 2,
    });
    fakeDb.seedCategory({
      id: 'INACTIVE_CAT',
      name: 'Danh mục tạm ngưng',
      slug: 'inactive',
      is_active: false,
      sort_order: 99,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, CategoriesModule, UserModule],
    })
      .overrideProvider(PostgresService)
      .useValue(fakeDb)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    jwtService = moduleFixture.get<JwtService>(ACCESS_TOKEN_JWT);
    approvedToken = jwtService.sign({
      sub: approvedUser.id,
      email: approvedUser.school_email,
      role: approvedUser.role,
      verificationStatus: approvedUser.verification_status,
      typ: 'access',
    });
    pendingToken = jwtService.sign({
      sub: pendingUser.id,
      email: pendingUser.school_email,
      role: pendingUser.role,
      verificationStatus: pendingUser.verification_status,
      typ: 'access',
    });
    suspendedToken = jwtService.sign({
      sub: suspendedUser.id,
      email: suspendedUser.school_email,
      role: suspendedUser.role,
      verificationStatus: suspendedUser.verification_status,
      typ: 'access',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/me (BR-03 & OpenAPI v1.2 MeResponse)', () => {
    it('should return 200 and profile for APPROVED user without sensitive fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${approvedToken}`)
        .expect(200);

      // Verify envelope structure
      expect(res.body.success).toBe(true);
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.body.data).toBeDefined();

      const profile = res.body.data;
      expect(profile.id).toBe(approvedUser.id);
      expect(profile.schoolEmail).toBe('student.approved@ptit.edu.vn');
      expect(profile.displayName).toBe('Nguyễn Văn Duyệt');
      expect(profile.phoneNumber).toBe('0912345678');
      expect(profile.role).toBe('USER');
      expect(profile.verificationStatus).toBe('APPROVED');
      expect(profile.school).toBe('Học viện Công nghệ Bưu chính Viễn thông');
      expect(profile.major).toBe('Công nghệ Thông tin');
      expect(profile.className).toBe('D20CNTT1');
      expect(profile.studentCode).toBe('B20DCCN001');
      expect(profile.cohort).toBe('2020');
      expect(profile.province).toBe('Hà Nội');
      expect(profile.reputationScore).toBe(5.0);
      expect(profile.createdAt).toBe('2026-11-01T08:00:00.000Z');

      // Security directive BR-03: Never return passwordHash, cardImageRef, etc.
      expect(profile.passwordHash).toBeUndefined();
      expect(profile.password_hash).toBeUndefined();
      expect(profile.cardImageRef).toBeUndefined();
      expect(profile.card_image_ref).toBeUndefined();
      expect(profile.codeHash).toBeUndefined();
    });

    it('should return 200 and profile for PENDING user (can view profile before approval)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(pendingUser.id);
      expect(res.body.data.verificationStatus).toBe('PENDING');
      expect(res.body.data.phoneNumber).toBeNull();
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .expect(401);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/v1/me (Update Contact Details)', () => {
    it('should return 200 and updated profile for APPROVED user', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          displayName: 'Nguyễn Văn Duyệt Mới',
          phoneNumber: '0999888777',
          province: 'TP. Hồ Chí Minh',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Nguyễn Văn Duyệt Mới');
      expect(res.body.data.phoneNumber).toBe('0999888777');
      expect(res.body.data.province).toBe('TP. Hồ Chí Minh');
    });

    it('should return 200 and allow clearing phoneNumber with null', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          phoneNumber: null,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneNumber).toBeNull();
    });

    it('should return 400 when attempting to update protected fields (schoolEmail, role, etc.)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          schoolEmail: 'hacker@ptit.edu.vn',
          role: 'ADMIN',
          reputationScore: 5.0,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 400 when displayName is empty whitespace', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          displayName: '   ',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 403 for PENDING user (only APPROVED can edit profile)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          displayName: 'Tên Không Hợp Lệ',
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('should return 403 for SUSPENDED user', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${suspendedToken}`)
        .send({
          displayName: 'Tên Không Hợp Lệ',
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/me')
        .send({ displayName: 'Anon' })
        .expect(401);
    });
  });

  describe('GET /api/v1/me/preferences', () => {
    it('should return 200 with default empty arrays when no preferences exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${approvedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.favoriteCategoryIds).toEqual([]);
      expect(res.body.data.interestKeywords).toEqual([]);
      expect(typeof res.body.data.updatedAt).toBe('string');
    });

    it('should return 403 for PENDING user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me/preferences')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/me/preferences', () => {
    it('should return 200 and save preferences with deduplicated categories and keywords', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS', 'TEXTBOOK'],
          interestKeywords: ['  Java  ', 'Python', 'java', '   ', 'React'],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.favoriteCategoryIds).toEqual(['TEXTBOOK', 'ELECTRONICS']);
      expect(res.body.data.interestKeywords).toEqual(['Java', 'Python', 'React']);
      expect(typeof res.body.data.updatedAt).toBe('string');

      // Verify GET returns the saved preferences
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${approvedToken}`)
        .expect(200);

      expect(getRes.body.data.favoriteCategoryIds).toEqual(['TEXTBOOK', 'ELECTRONICS']);
      expect(getRes.body.data.interestKeywords).toEqual(['Java', 'Python', 'React']);
    });

    it('should return 400 when category ID is inactive or does not exist', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          favoriteCategoryIds: ['TEXTBOOK', 'INACTIVE_CAT', 'NON_EXISTENT'],
          interestKeywords: ['Java'],
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 when invalid body format is sent', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${approvedToken}`)
        .send({
          favoriteCategoryIds: 'NOT_AN_ARRAY',
          interestKeywords: ['Java'],
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 403 for PENDING user', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          favoriteCategoryIds: ['TEXTBOOK'],
          interestKeywords: ['Java'],
        })
        .expect(403);

      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/me/preferences')
        .send({
          favoriteCategoryIds: ['TEXTBOOK'],
          interestKeywords: ['Java'],
        })
        .expect(401);
    });
  });
});

