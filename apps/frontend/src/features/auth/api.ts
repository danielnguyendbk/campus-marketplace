import { api, ApiClient, ApiError, API_BASE_URL, type ApiTransport } from '../../services/api';
import { createAuthMockAdapter } from './mock-adapter';
import { createMarketplaceApi } from '../marketplace/api';
import {
  isAuthSession,
  type AuthMode,
  type AuthSession,
  type LoginBody,
  type RequestOtpBody,
  type RegisterBody,
  type SimpleMessage,
  type VerifyOtpBody,
  type VerifyOtpResult,
} from './types';

export const AUTH_MODE: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_API_MODE === 'mock' ? 'mock' : 'live';

export function createAuthApi(mode: AuthMode = 'live', transport?: ApiTransport) {
  const client =
    transport || mode === 'mock'
      ? new ApiClient(API_BASE_URL, transport ?? createAuthMockAdapter())
      : api;
  let currentSession: AuthSession | null = null;
  let expiration: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const marketplace = createMarketplaceApi(client);
  const notify = () => listeners.forEach((listener) => listener());
  function clearSession() {
    clearTimeout(expiration);
    currentSession = null;
    client.setToken(null);
    notify();
  }
  function acceptSession(result: unknown, registration = false, signal?: AbortSignal): AuthSession {
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (
      !isAuthSession(result) ||
      (registration &&
        (result.user.role !== 'USER' || result.user.verificationStatus !== 'PENDING'))
    ) {
      throw new ApiError('Invalid authentication session', 200, 'INVALID_AUTH_SESSION');
    }
    if (result.user.verificationStatus === 'SUSPENDED') {
      throw new ApiError('Tài khoản đang bị đình chỉ.', 403, 'ACCOUNT_SUSPENDED');
    }
    clearTimeout(expiration);
    currentSession = result;
    client.setToken(result.accessToken);
    expiration = setTimeout(clearSession, Math.min(result.expiresIn * 1000, 2_147_483_647));
    notify();
    return result;
  }
  return {
    mode,
    clearSession,
    getSession: () => currentSession,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getFeed: marketplace.getFeed,
    async getVerification(signal?: AbortSignal) {
      const activeToken = currentSession?.accessToken;
      const state = await marketplace.getVerification(signal);
      if (
        !signal?.aborted &&
        currentSession &&
        currentSession.accessToken === activeToken &&
        state.status !== currentSession.user.verificationStatus
      ) {
        if (state.status === 'SUSPENDED') clearSession();
        else {
          currentSession = {
            ...currentSession,
            user: { ...currentSession.user, verificationStatus: state.status },
          };
          notify();
        }
      }
      return state;
    },
    async submitEvidence(...args: Parameters<typeof marketplace.submitEvidence>) {
      const activeToken = currentSession?.accessToken;
      const state = await marketplace.submitEvidence(...args);
      if (!args[2]?.aborted && currentSession && currentSession.accessToken === activeToken) {
        if (state.status === 'SUSPENDED') clearSession();
        else {
          currentSession = {
            ...currentSession,
            user: { ...currentSession.user, verificationStatus: state.status },
          };
          notify();
        }
      }
      return state;
    },
    async requestOtp(body: RequestOtpBody, signal?: AbortSignal): Promise<SimpleMessage> {
      const result = await client.request<SimpleMessage>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: body.email }),
        signal,
      });
      if (!result || result.success !== true || typeof result.message !== 'string') {
        throw new ApiError('Invalid OTP request response', 200, 'INVALID_AUTH_RESPONSE');
      }
      return result;
    },
    async verifyOtp(body: VerifyOtpBody, signal?: AbortSignal): Promise<VerifyOtpResult> {
      const result = await client.request<VerifyOtpResult>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: body.email, code: body.code }),
        signal,
      });
      if (
        !result ||
        typeof result.otpTicket !== 'string' ||
        !result.otpTicket ||
        !Number.isInteger(result.expiresIn) ||
        result.expiresIn <= 0
      ) {
        throw new ApiError('Invalid OTP verification response', 200, 'INVALID_AUTH_RESPONSE');
      }
      return result;
    },
    async register(body: RegisterBody, signal?: AbortSignal): Promise<AuthSession> {
      return acceptSession(
        await client.request<unknown>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            otpTicket: body.otpTicket,
            displayName: body.displayName,
            password: body.password,
          }),
          signal,
        }),
        true,
        signal,
      );
    },
    async login(body: LoginBody, signal?: AbortSignal): Promise<AuthSession> {
      return acceptSession(
        await client.request<unknown>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: body.email, password: body.password }),
          signal,
        }),
        false,
        signal,
      );
    },
  };
}
export type AuthApi = ReturnType<typeof createAuthApi>;
export const authApi = createAuthApi(AUTH_MODE);

export function authErrorMessage(
  error: unknown,
  action: 'login' | 'request' | 'verify' | 'register',
): string {
  if (!(error instanceof ApiError)) return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
  if (
    error.code.startsWith('INVALID_RESPONSE') ||
    error.code === 'INVALID_JSON' ||
    error.code.startsWith('INVALID_AUTH')
  ) {
    return 'Chưa thể xác nhận phản hồi từ hệ thống. Vui lòng thử lại sau.';
  }
  if (error.status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
  if (error.status === 401)
    return action === 'login'
      ? 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.'
      : 'Phiên xác thực không hợp lệ. Vui lòng thực hiện lại.';
  if (error.status === 403) return 'Tài khoản hiện không được phép thực hiện thao tác này.';
  if (error.status === 429)
    return 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại.';
  if ([400, 409, 422].includes(error.status)) return error.message;
  return 'Yêu cầu chưa thành công. Vui lòng thử lại.';
}
