import { QueryResult, QueryResultRow } from 'pg';
import { PostgresService } from '../../../database/postgres.service';
import { AdminVerificationDetailRow } from '../verification.types';
import { EvidenceRepository } from './evidence.repository';

const createMockQueryResult = <T extends QueryResultRow>(rows: T[]): QueryResult<T> => ({
  rows,
  rowCount: rows.length,
  command: '',
  oid: 0,
  fields: [],
});

describe('EvidenceRepository', () => {
  let repository: EvidenceRepository;
  let postgresService: PostgresService;

  beforeEach(() => {
    postgresService = new PostgresService();
    repository = new EvidenceRepository(postgresService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should create an evidence record and return it', async () => {
    const mockRow = {
      id: 'evi-uuid-1',
      user_id: 'user-uuid-1',
      card_image_ref: 'evidence/user-uuid-1/card.jpg',
      submitted_at: new Date(),
      reviewed_by: null,
      reviewed_at: null,
      reason: null,
    };

    jest.spyOn(postgresService, 'query').mockResolvedValueOnce(createMockQueryResult([mockRow]));

    const result = await repository.createEvidence('user-uuid-1', 'evidence/user-uuid-1/card.jpg');
    expect(result).toEqual(mockRow);
  });

  it('should fetch the latest evidence for a user', async () => {
    const mockRow = {
      id: 'evi-uuid-2',
      user_id: 'user-uuid-1',
      card_image_ref: 'evidence/user-uuid-1/card2.jpg',
      submitted_at: new Date(),
      reviewed_by: null,
      reviewed_at: null,
      reason: 'Ảnh mờ',
    };

    jest.spyOn(postgresService, 'query').mockResolvedValueOnce(createMockQueryResult([mockRow]));

    const result = await repository.getLatestByUserId('user-uuid-1');
    expect(result).toEqual(mockRow);
  });

  it('should return null when user has no evidence submitted', async () => {
    jest.spyOn(postgresService, 'query').mockResolvedValueOnce(createMockQueryResult([]));

    const result = await repository.getLatestByUserId('user-uuid-none');
    expect(result).toBeNull();
  });

  it('should update user student info', async () => {
    const querySpy = jest
      .spyOn(postgresService, 'query')
      .mockResolvedValueOnce(createMockQueryResult([]));

    await repository.updateUserStudentInfo('user-uuid-1', {
      school: 'PTIT',
      studentCode: 'B21DCCN001',
      className: 'D21CQCN01',
      major: 'CNTT',
      cohort: '2021',
      province: 'TP. Hồ Chí Minh',
    });

    expect(querySpy).toHaveBeenCalled();
  });

  describe('listVerifications', () => {
    it('should query verifications list with pagination and optional status filter', async () => {
      const mockDetailRow: AdminVerificationDetailRow = {
        id: 'evi-uuid-1',
        user_id: 'user-uuid-1',
        card_image_ref: 'evidence/user-uuid-1/card.jpg',
        submitted_at: new Date(),
        reviewed_by: null,
        reviewed_at: null,
        reason: null,
        school_email: 'student@ptithcm.edu.vn',
        display_name: 'Nguyen Van A',
        school: 'PTIT',
        student_code: 'B21DCCN001',
        verification_status: 'PENDING',
      };

      const querySpy = jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([mockDetailRow]));

      const results = await repository.listVerifications({
        page: 1,
        limit: 20,
        status: 'PENDING',
      });

      expect(results).toEqual([mockDetailRow]);
      expect(querySpy).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        'PENDING',
        20,
        0,
      ]);
    });
  });

  describe('countVerifications', () => {
    it('should return total count of verifications', async () => {
      jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([{ total: 42 }]));

      const total = await repository.countVerifications('PENDING');
      expect(total).toBe(42);
    });
  });

  describe('getVerificationDetailById', () => {
    it('should return detail row if found', async () => {
      const mockDetailRow: AdminVerificationDetailRow = {
        id: 'evi-uuid-1',
        user_id: 'user-uuid-1',
        card_image_ref: 'evidence/user-uuid-1/card.jpg',
        submitted_at: new Date(),
        reviewed_by: null,
        reviewed_at: null,
        reason: null,
        school_email: 'student@ptithcm.edu.vn',
        display_name: 'Nguyen Van A',
        school: 'PTIT',
        student_code: 'B21DCCN001',
        verification_status: 'PENDING',
      };

      jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([mockDetailRow]));

      const result = await repository.getVerificationDetailById('evi-uuid-1');
      expect(result).toEqual(mockDetailRow);
    });

    it('should return null if not found', async () => {
      jest.spyOn(postgresService, 'query').mockResolvedValueOnce(createMockQueryResult([]));

      const result = await repository.getVerificationDetailById('not-found-id');
      expect(result).toBeNull();
    });
  });

  describe('updateReviewStatus', () => {
    it('should execute updates for evidence and user status', async () => {
      const querySpy = jest
        .spyOn(postgresService, 'query')
        .mockResolvedValue(createMockQueryResult([]));

      await repository.updateReviewStatus({
        verificationId: 'evi-uuid-1',
        userId: 'user-uuid-1',
        adminId: 'admin-uuid-1',
        decision: 'APPROVED',
      });

      expect(querySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByCardImageRef', () => {
    it('should query evidence by card image ref', async () => {
      const mockEvidence = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        card_image_ref: 'student-cards/test.jpg',
        submitted_at: new Date(),
        reviewed_by: null,
        reviewed_at: null,
        reason: null,
      };
      const querySpy = jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([mockEvidence]));

      const result = await repository.findByCardImageRef('student-cards/test.jpg');

      expect(result).toEqual(mockEvidence);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('WHERE "card_image_ref" = $1'),
        ['student-cards/test.jpg'],
      );
    });
  });

  describe('recordAuditLog', () => {
    it('should insert audit log entry with actor_type and details', async () => {
      const querySpy = jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([]));

      await repository.recordAuditLog(
        '550e8400-e29b-41d4-a716-446655440001',
        'VIEW_EVIDENCE',
        'student_evidences',
        '550e8400-e29b-41d4-a716-446655440002',
        { viewedAt: '2026-11-17T09:00:00.000Z' },
      );

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "audit_logs" ("actor_type", "actor_id", "action", "target_type", "target_id", "details"'),
        [
          'USER',
          '550e8400-e29b-41d4-a716-446655440001',
          'VIEW_EVIDENCE',
          'student_evidences',
          '550e8400-e29b-41d4-a716-446655440002',
          JSON.stringify({ viewedAt: '2026-11-17T09:00:00.000Z' }),
        ],
      );
    });
  });

  describe('createNotification', () => {
    it('should insert notification entry with recipient_id and reference_id', async () => {
      const querySpy = jest
        .spyOn(postgresService, 'query')
        .mockResolvedValueOnce(createMockQueryResult([]));

      await repository.createNotification(
        '550e8400-e29b-41d4-a716-446655440001',
        'Verification Success',
        'Your evidence was approved',
        'VERIFICATION_RESULT',
        '550e8400-e29b-41d4-a716-446655440002',
      );

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "notifications" (\n        "recipient_id"'),
        [
          '550e8400-e29b-41d4-a716-446655440001',
          'Verification Success',
          'Your evidence was approved',
          'VERIFICATION_RESULT',
          '550e8400-e29b-41d4-a716-446655440002',
          'student_evidences',
        ],
      );
    });
  });
});
