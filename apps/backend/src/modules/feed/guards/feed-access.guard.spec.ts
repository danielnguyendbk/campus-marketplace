import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import { FeedAccessGuard } from './feed-access.guard';

function createMockContext(
  user?: Record<string, unknown>,
  query: Record<string, unknown> = {},
): {
  context: ExecutionContext;
  request: { user?: Record<string, unknown>; query: Record<string, unknown> };
} {
  const request: { user?: Record<string, unknown>; query: Record<string, unknown> } = {
    user,
    query,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('FeedAccessGuard', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const guard = new FeedAccessGuard(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeUserRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    school_email: 'sv@ptithcm.edu.vn',
    display_name: 'Nguyễn Văn A',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: '5.0',
    province: 'TP. Hồ Chí Minh',
    ...overrides,
  });

  it('throws 401 UNAUTHORIZED when req.user is missing', async () => {
    const { context } = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 UNAUTHORIZED when user does not exist or is soft-deleted in DB', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { context } = createMockContext({ id: 'missing-user' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: 'UNAUTHORIZED' },
    });
  });

  it.each(['USER', 'ADMIN'] as const)(
    'throws 403 ACCOUNT_SUSPENDED when %s account is SUSPENDED (even with stale APPROVED JWT)',
    async (role) => {
      queryMock.mockResolvedValueOnce({
        rows: [makeUserRow({ role, verification_status: 'SUSPENDED' })],
      });
      const { context } = createMockContext({
        id: 'user-1',
        role,
        verificationStatus: 'APPROVED',
      });
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_SUSPENDED' },
      });
    },
  );

  it('throws 403 ACCOUNT_NOT_VERIFIED when non-admin user is REJECTED', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [makeUserRow({ verification_status: 'REJECTED' })],
    });
    const { context } = createMockContext({ id: 'user-1' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_NOT_VERIFIED' },
    });
    expect(ForbiddenException).toBeDefined();
  });

  it.each(['q', 'type', 'categoryId', 'min', 'max', 'province', 'sort'])(
    'blocks PENDING user sending search/filter query param "%s" with 403 ACCOUNT_NOT_VERIFIED (AC2)',
    async (paramKey) => {
      queryMock.mockResolvedValueOnce({
        rows: [makeUserRow({ verification_status: 'PENDING' })],
      });
      const { context } = createMockContext(
        { id: 'user-1', verificationStatus: 'PENDING' },
        { page: '1', [paramKey]: 'test' },
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_NOT_VERIFIED' },
      });
    },
  );

  it('allows PENDING user with no query or only page/limit and refreshes req.user from DB', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [makeUserRow({ verification_status: 'PENDING', province: null })],
    });
    const { context, request } = createMockContext(
      { id: 'user-1', verificationStatus: 'PENDING' },
      { page: '1', limit: '20' },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      schoolEmail: 'sv@ptithcm.edu.vn',
      role: 'USER',
      verificationStatus: 'PENDING',
      displayName: 'Nguyễn Văn A',
      reputationScore: 5,
      province: null,
    });
  });

  it('allows APPROVED user and refreshes stale PENDING JWT claims from live DB', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        makeUserRow({
          verification_status: 'APPROVED',
          reputation_score: '4.7',
          province: 'Hà Nội',
        }),
      ],
    });
    const { context, request } = createMockContext(
      { id: 'user-1', verificationStatus: 'PENDING' },
      {},
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      schoolEmail: 'sv@ptithcm.edu.vn',
      role: 'USER',
      verificationStatus: 'APPROVED',
      displayName: 'Nguyễn Văn A',
      reputationScore: 4.7,
      province: 'Hà Nội',
    });
  });

  it('allows non-suspended ADMIN user even when verification_status is PENDING', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [makeUserRow({ role: 'ADMIN', verification_status: 'PENDING' })],
    });
    const { context, request } = createMockContext(
      { id: 'admin-1', role: 'ADMIN' },
      { page: '2' },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.role).toBe('ADMIN');
  });
});
