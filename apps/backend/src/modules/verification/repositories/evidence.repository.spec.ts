import { QueryResult, QueryResultRow } from 'pg';
import { PostgresService } from '../../../database/postgres.service';
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
});
