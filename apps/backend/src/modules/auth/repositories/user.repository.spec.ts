import { PostgresService } from '../../../database/postgres.service';
import { UserRepository } from './user.repository';

describe('UserRepository.createUser', () => {
  it('inserts directly into users relying on DB defaults for role (USER) and verification_status (PENDING)', async () => {
    const generatedId = '0d8d830e-11bd-440a-b72e-24c8bd3a519a';
    const executedQueries: { sql: string; params?: unknown[] }[] = [];

    const mockPostgres = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        executedQueries.push({ sql, params });
        return {
          rows: [
            {
              id: generatedId,
              display_name: 'Sinh viên A',
              role: 'USER',
              verification_status: 'PENDING',
            },
          ],
          rowCount: 1,
        };
      }),
    } as unknown as PostgresService;

    const repo = new UserRepository(mockPostgres);
    const result = await repo.createUser({
      schoolEmail: 'sv@ptit.edu.vn',
      passwordHash: '$2b$12$hashedpassword',
      displayName: 'Sinh viên A',
    });

    expect(executedQueries).toHaveLength(1);
    expect(executedQueries[0].sql).toContain('INSERT INTO "users"');
    expect(executedQueries[0].sql).not.toContain('user_preferences');
    expect(executedQueries[0].params).toEqual([
      'sv@ptit.edu.vn',
      '$2b$12$hashedpassword',
      'Sinh viên A',
    ]);
    expect(result).toEqual({
      id: generatedId,
      displayName: 'Sinh viên A',
      role: 'USER',
      verificationStatus: 'PENDING',
    });
  });
});
