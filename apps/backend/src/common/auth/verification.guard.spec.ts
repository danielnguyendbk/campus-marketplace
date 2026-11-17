import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { VerificationGuard } from './verification.guard';

function createMockContext(user?: Record<string, unknown>): {
  context: ExecutionContext;
  request: { user?: Record<string, unknown> };
} {
  const request: { user?: Record<string, unknown> } = { user };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('VerificationGuard', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const guard = new VerificationGuard(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 401 when req.user is missing', async () => {
    const { context } = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when user does not exist in DB', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { context } = createMockContext({ id: 'user-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 403 ACCOUNT_SUSPENDED when user is SUSPENDED', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          school_email: 'sv@ptithcm.edu.vn',
          display_name: 'SV',
          role: 'USER',
          verification_status: 'SUSPENDED',
          reputation_score: '5.0',
          province: null,
        },
      ],
    });
    const { context } = createMockContext({ id: 'user-1' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_SUSPENDED' },
    });
  });

  it.each(['PENDING', 'REJECTED'] as const)(
    'throws 403 ACCOUNT_NOT_VERIFIED when user is %s',
    async (status) => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            school_email: 'sv@ptithcm.edu.vn',
            display_name: 'SV',
            role: 'USER',
            verification_status: status,
            reputation_score: '5.0',
            province: null,
          },
        ],
      });
      const { context } = createMockContext({ id: 'user-1' });
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_NOT_VERIFIED' },
      });
      expect(ForbiddenException).toBeDefined();
    },
  );

  it('allows APPROVED user and enriches req.user from DB', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          school_email: 'sv@ptithcm.edu.vn',
          display_name: 'Nguyễn Văn A',
          role: 'USER',
          verification_status: 'APPROVED',
          reputation_score: '4.8',
          province: 'TP. Hồ Chí Minh',
        },
      ],
    });
    const { context, request } = createMockContext({
      id: 'user-1',
      verificationStatus: 'PENDING',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      schoolEmail: 'sv@ptithcm.edu.vn',
      role: 'USER',
      verificationStatus: 'APPROVED',
      displayName: 'Nguyễn Văn A',
      reputationScore: 4.8,
      province: 'TP. Hồ Chí Minh',
    });
  });
});
