import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsAuthGuard } from './ws-auth.guard';

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;

  beforeEach(() => {
    guard = new WsAuthGuard();
  });

  const createMockContext = (user?: unknown): ExecutionContext => {
    return {
      switchToWs: () => ({
        getClient: () => ({
          data: { user },
        }),
        getData: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow APPROVED user', () => {
    const context = createMockContext({
      id: 'user-1',
      role: 'USER',
      verificationStatus: 'APPROVED',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN user even if not APPROVED', () => {
    const context = createMockContext({
      id: 'admin-1',
      role: 'ADMIN',
      verificationStatus: 'PENDING',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UNAUTHORIZED if user is missing', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(WsException);
    try {
      guard.canActivate(context);
    } catch (err: unknown) {
      expect((err as WsException).getError()).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
      });
    }
  });

  it('should throw ACCOUNT_SUSPENDED if user is SUSPENDED', () => {
    const context = createMockContext({
      id: 'user-suspended',
      role: 'USER',
      verificationStatus: 'SUSPENDED',
    });
    expect(() => guard.canActivate(context)).toThrow(WsException);
    try {
      guard.canActivate(context);
    } catch (err: unknown) {
      expect((err as WsException).getError()).toEqual({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa.',
      });
    }
  });

  it('should throw ACCOUNT_NOT_VERIFIED if user is PENDING', () => {
    const context = createMockContext({
      id: 'user-pending',
      role: 'USER',
      verificationStatus: 'PENDING',
    });
    expect(() => guard.canActivate(context)).toThrow(WsException);
    try {
      guard.canActivate(context);
    } catch (err: unknown) {
      expect((err as WsException).getError()).toEqual({
        code: 'ACCOUNT_NOT_VERIFIED',
        message:
          'Chỉ tài khoản sinh viên đã xác thực (APPROVED) mới được phép thực hiện thao tác này.',
      });
    }
  });
});

