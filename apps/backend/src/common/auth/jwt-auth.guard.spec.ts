import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload, OtpTicketPayload } from '../../modules/auth/auth.types';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const accessSecret = 'test-access-token-secret-at-least-32-chars!!';
  const ticketSecret = 'test-otp-ticket-secret-at-least-32-chars!!';
  const accessJwt = new JwtService({ secret: accessSecret });
  const ticketJwt = new JwtService({ secret: ticketSecret });
  const guard = new JwtAuthGuard(accessJwt);

  const buildContext = (authorization?: string): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } => {
    const request = {
      headers: authorization ? { authorization } : {},
    } as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  it('populates req.user when given a valid access token', async () => {
    const payload: AccessTokenPayload = {
      sub: '11111111-2222-3333-4444-555555555555',
      email: 'sv01@stu.ptit.edu.vn',
      role: 'USER',
      verificationStatus: 'PENDING',
      typ: 'access',
    };
    const token = await accessJwt.signAsync(payload, { expiresIn: 3600 });
    const { context, request } = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: payload.sub,
      schoolEmail: payload.email,
      role: 'USER',
      verificationStatus: 'PENDING',
    });
  });

  it('rejects missing Authorization header with 401 UNAUTHORIZED', async () => {
    const { context } = buildContext(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects non-Bearer scheme or malformed header with 401', async () => {
    const { context } = buildContext('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects expired access tokens with 401', async () => {
    const payload: AccessTokenPayload = {
      sub: '11111111-2222-3333-4444-555555555555',
      email: 'sv01@stu.ptit.edu.vn',
      role: 'USER',
      verificationStatus: 'PENDING',
      typ: 'access',
    };
    const expired = await accessJwt.signAsync(payload, { expiresIn: -10 });
    const { context } = buildContext(`Bearer ${expired}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an otp_ticket token even if signed or presented as Bearer', async () => {
    const ticketPayload: OtpTicketPayload = {
      sub: 'sv01@stu.ptit.edu.vn',
      otpId: '99999999-8888-7777-6666-555555555555',
      typ: 'otp_ticket',
    };
    // Case 1: signed with otpTicket secret
    const ticket1 = await ticketJwt.signAsync(ticketPayload, { expiresIn: 600 });
    await expect(
      guard.canActivate(buildContext(`Bearer ${ticket1}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Case 2: even if signed with access secret, typ !== 'access' is rejected
    const ticket2 = await accessJwt.signAsync(ticketPayload, { expiresIn: 600 });
    await expect(
      guard.canActivate(buildContext(`Bearer ${ticket2}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

