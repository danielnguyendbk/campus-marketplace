import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { AuthenticatedSocket } from '../realtime.types';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const user = client.data?.user as AuthenticatedUser | undefined;

    if (!user || !user.id) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
      });
    }

    if (user.verificationStatus === 'SUSPENDED') {
      throw new WsException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa.',
      });
    }

    if (user.verificationStatus !== 'APPROVED' && user.role !== 'ADMIN') {
      throw new WsException({
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'Chỉ tài khoản sinh viên đã xác thực (APPROVED) mới được phép thực hiện thao tác này.',
      });
    }

    return true;
  }
}

