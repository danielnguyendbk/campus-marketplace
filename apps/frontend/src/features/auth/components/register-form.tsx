'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '../../../services/api';
import { authApi, authErrorMessage, type AuthApi } from '../api';
import { emailValidation, type AuthSession, type VerifyOtpResult } from '../types';
import { AuthModeNotice } from './auth-mode-notice';
import { SessionResult } from './session-result';
import styles from '../auth.module.css';

type Step = 'email' | 'otp' | 'password';
type Field = 'email' | 'code' | 'displayName' | 'password' | 'confirmPassword';
type Errors = Partial<Record<Field, string>>;
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: Field;
  label: string;
  error?: string;
  hint?: string;
}

function FieldInput({ id, label, error, hint, ...props }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={`register-${id}`}>{label}</label>
      <input
        {...props}
        name={id}
        id={`register-${id}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `register-${id}-help` : undefined}
      />
      {(error || hint) && (
        <p id={`register-${id}-help`} className={error ? styles.fieldError : styles.fieldHint}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function RegisterForm({ client = authApi }: { client?: AuthApi }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [values, setValues] = useState<Record<Field, string>>({
    email: '',
    code: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [ticket, setTicket] = useState<(VerifyOtpResult & { expiresAt: number }) | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!ticket || session) return;
    const timer = setInterval(() => {
      if (busy.current || Date.now() < ticket.expiresAt) return;
      setTicket(null);
      setValues((current) => ({ ...current, password: '', confirmPassword: '', code: '' }));
      setStep('otp');
      setError('Phiên xác thực đã hết hạn. Vui lòng gửi lại mã và xác thực email.');
      setNotice('');
    }, 1000);
    return () => clearInterval(timer);
  }, [ticket, session]);

  const change = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  };
  function invalid(next: Errors): boolean {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (!first) return false;
    (form.current?.elements.namedItem(first) as HTMLInputElement | null)?.focus();
    return true;
  }
  function resetVerification() {
    setTicket(null);
    setValues((current) => ({ ...current, code: '', password: '', confirmPassword: '' }));
    setErrors({});
    setError('');
    setNotice('');
    setShowPassword(false);
  }
  async function run(
    action: 'request' | 'verify' | 'register',
    work: (signal: AbortSignal) => Promise<void>,
  ) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    setNotice('');
    const controller = new AbortController();
    request.current = controller;
    try {
      await work(controller.signal);
    } catch (failure: unknown) {
      if (!controller.signal.aborted && mounted.current) {
        setError(authErrorMessage(failure, action));
        if (action === 'register' && failure instanceof ApiError && failure.status === 422) {
          setTicket(null);
          setStep('otp');
          setValues((current) => ({ ...current, code: '', password: '', confirmPassword: '' }));
        }
      }
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  async function sendOtp() {
    const email = values.email.trim().toLowerCase();
    const emailError = emailValidation(email, true);
    if (invalid(emailError ? { email: emailError } : {})) return;
    await run('request', async (signal) => {
      const result = await client.requestOtp({ email }, signal);
      if (!mounted.current || signal.aborted) return;
      resetVerification();
      setValues((current) => ({ ...current, email }));
      setNotice(result.message);
      setStep('otp');
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (step === 'email') {
      await sendOtp();
      return;
    }
    if (step === 'otp') {
      const code = values.code.trim();
      if (
        invalid(
          code.length < 4 || code.length > 12
            ? { code: 'Vui lòng nhập mã OTP từ 4 đến 12 ký tự.' }
            : {},
        )
      )
        return;
      await run('verify', async (signal) => {
        const result = await client.verifyOtp({ email: values.email, code }, signal);
        if (!mounted.current || signal.aborted) return;
        setTicket({ ...result, expiresAt: Date.now() + result.expiresIn * 1000 });
        setValues((current) => ({ ...current, code: '' }));
        setErrors({});
        setStep('password');
      });
      return;
    }
    if (!ticket || Date.now() >= ticket.expiresAt) {
      setTicket(null);
      setStep('otp');
      setError('Phiên xác thực đã hết hạn. Vui lòng gửi lại mã.');
      setValues((current) => ({ ...current, password: '', confirmPassword: '' }));
      return;
    }
    const next: Errors = {};
    if (!values.displayName.trim() || values.displayName.trim().length > 255)
      next.displayName = 'Tên hiển thị cần có từ 1 đến 255 ký tự.';
    if (values.password.length < 8) next.password = 'Mật khẩu cần có ít nhất 8 ký tự.';
    if (!values.confirmPassword || values.confirmPassword !== values.password)
      next.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    if (invalid(next)) return;
    await run('register', async (signal) => {
      const result = await client.register(
        {
          otpTicket: ticket.otpTicket,
          displayName: values.displayName.trim(),
          password: values.password,
        },
        signal,
      );
      if (!mounted.current || signal.aborted) return;
      setTicket(null);
      setValues((current) => ({ ...current, password: '', confirmPassword: '' }));
      setSession(result);
      router.replace('/verification');
    });
  }

  if (session)
    return (
      <>
        <AuthModeNotice mode={client.mode} />
        <SessionResult session={session} registered />
      </>
    );
  const steps: Step[] = ['email', 'otp', 'password'];
  const titles: Record<Step, string> = {
    email: 'Tạo tài khoản sinh viên',
    otp: 'Xác thực email',
    password: 'Hoàn tất tài khoản',
  };
  return (
    <>
      <p className={styles.kicker}>BẮT ĐẦU MỘT VÒNG ĐỜI MỚI</p>
      <h2 ref={heading} tabIndex={-1} className={styles.formTitle}>
        {titles[step]}
      </h2>
      <p className={styles.formDescription}>
        {step === 'email'
          ? 'Tham gia cộng đồng bằng email trường của bạn.'
          : step === 'otp'
            ? 'Nhập mã được gửi đến email trường để tiếp tục.'
            : 'Email đã được xác thực. Hãy chọn tên và mật khẩu của bạn.'}
      </p>
      <ol className={styles.steps} aria-label="Tiến trình đăng ký">
        {steps.map((item, index) => (
          <li
            key={item}
            aria-current={step === item ? 'step' : undefined}
            className={steps.indexOf(step) >= index ? styles.activeStep : undefined}
          >
            <span aria-hidden="true">{steps.indexOf(step) > index ? '✓' : index + 1}</span>
            {['Email', 'Xác thực OTP', 'Mật khẩu'][index]}
          </li>
        ))}
      </ol>
      <AuthModeNotice mode={client.mode} />
      {step !== 'email' && (
        <div className={styles.emailSummary}>
          <span>{values.email}</span>
          <button
            type="button"
            disabled={loading}
            className={styles.textButton}
            onClick={() => {
              resetVerification();
              setStep('email');
            }}
          >
            Đổi email
          </button>
        </div>
      )}
      <form
        ref={form}
        className={styles.form}
        method="post"
        onSubmit={submit}
        noValidate
        aria-busy={loading}
      >
        {step === 'email' && (
          <FieldInput
            id="email"
            label="Email trường"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tenban@truong.edu.vn"
            required
            value={values.email}
            disabled={loading}
            onChange={change('email')}
            error={errors.email}
            hint="Sử dụng email thuộc tên miền trường .edu.vn. Hệ thống sẽ kiểm tra trường được phép đăng ký."
          />
        )}
        {step === 'otp' && (
          <FieldInput
            id="code"
            label="Mã OTP"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            autoCapitalize="none"
            minLength={4}
            maxLength={12}
            required
            value={values.code}
            disabled={loading}
            onChange={change('code')}
            error={errors.code}
            placeholder="Nhập mã xác thực"
            hint="Bạn có thể dán toàn bộ mã. Kiểm tra cả thư mục Spam nếu chưa nhận được email."
          />
        )}
        {step === 'password' && ticket && (
          <>
            <FieldInput
              id="displayName"
              label="Tên hiển thị"
              type="text"
              autoComplete="nickname"
              maxLength={255}
              required
              value={values.displayName}
              disabled={loading}
              onChange={change('displayName')}
              error={errors.displayName}
              placeholder="Tên bạn muốn mọi người gọi"
            />
            <FieldInput
              id="password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              required
              value={values.password}
              disabled={loading}
              onChange={change('password')}
              error={errors.password}
              placeholder="Ít nhất 8 ký tự"
              hint="Nên dùng mật khẩu riêng cho tài khoản này."
            />
            <FieldInput
              id="confirmPassword"
              label="Xác nhận mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={values.confirmPassword}
              disabled={loading}
              onChange={change('confirmPassword')}
              error={errors.confirmPassword}
              placeholder="Nhập lại mật khẩu"
            />
            <button
              className={styles.textButton}
              type="button"
              disabled={loading}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            </button>
          </>
        )}
        {notice && (
          <p className={styles.infoNotice} role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className={styles.errorNotice} role="alert">
            {error}
          </p>
        )}
        <button className={styles.submitButton} type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Đang xử lý…
            </>
          ) : step === 'email' ? (
            'Gửi mã xác thực'
          ) : step === 'otp' ? (
            'Xác thực OTP'
          ) : (
            'Tạo tài khoản'
          )}
        </button>
        {step === 'otp' && (
          <div className={styles.resendRow}>
            <span>Chưa nhận được mã?</span>
            <button
              className={styles.textButton}
              type="button"
              onClick={sendOtp}
              disabled={loading}
            >
              Gửi lại mã
            </button>
          </div>
        )}
      </form>
      <p className={styles.switchForm}>
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </>
  );
}
