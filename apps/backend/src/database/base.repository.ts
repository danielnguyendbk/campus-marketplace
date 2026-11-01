import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PostgresService } from './postgres.service';

export abstract class BaseRepository<T extends QueryResultRow> {
  constructor(
    protected readonly postgresService: PostgresService,
    protected readonly tableName: string,
  ) {}

  /**
   * Executes a parameterized query using either the shared pool or an active transaction client.
   */
  protected async executeQuery<R extends QueryResultRow = T>(
    sql: string,
    params?: unknown[],
    client?: PoolClient,
  ): Promise<QueryResult<R>> {
    if (client) {
      return client.query<R>(sql, params);
    }
    return this.postgresService.query<R>(sql, params);
  }

  /**
   * Helper to count total rows in the repository's table.
   */
  async count(whereClause?: string, params?: unknown[], client?: PoolClient): Promise<number> {
    const where = whereClause ? `WHERE ${whereClause}` : '';
    const sql = `SELECT COUNT(*)::int AS total FROM "${this.tableName}" ${where};`;
    const res = await this.executeQuery<{ total: number }>(sql, params, client);
    return res.rows[0]?.total ?? 0;
  }
}
