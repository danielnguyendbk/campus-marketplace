import { PoolClient } from 'pg';
import { PostgresService } from '../../../database/postgres.service';
import { UserRepository } from './user.repository';

describe('UserRepository.createWithPreferences (reversed FK workaround D2)', () => {
  it('inserts user_preferences before users inside a single transaction using the same generated id', async () => {
    const executedQueries: { sql: string; params?: unknown[] }[] = [];
    const generatedId = '0d8d830e-11bd-440a-b72e-24c8bd3a519a';

    const mockClient = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        executedQueries.push({ sql, params });
        if (sql.includes('INSERT INTO "user_preferences"')) {
          return { rows: [{ user_id: generatedId }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO "users"')) {
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
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    } as unknown as PoolClient;

    const mockPostgres = {
      withTransaction: jest.fn(
        async <T>(cb: (client: PoolClient) => Promise<T>): Promise<T> =>
          cb(mockClient),
      ),
    } as unknown as PostgresService;

    const repo = new UserRepository(mockPostgres);
    const result = await repo.createWithPreferences({
      schoolEmail: 'sv@ptit.edu.vn',
      passwordHash: '$2b$12$hashedpassword',
      displayName: 'Sinh viên A',
    });

    expect(mockPostgres.withTransaction).toHaveBeenCalledTimes(1);
    expect(executedQueries).toHaveLength(2);
    expect(executedQueries[0].sql).toContain('INSERT INTO "user_preferences"');
    expect(executedQueries[1].sql).toContain('INSERT INTO "users"');
    expect(executedQueries[1].params).toEqual([
      generatedId,
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

