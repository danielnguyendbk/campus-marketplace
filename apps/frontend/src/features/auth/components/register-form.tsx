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
type AuthAction = 'request' | 'verify' | 'register';
const OTP_LENGTH = 6;
const OTP_AUTOVERIFY_DELAY_MS = 250;

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: Field;
  label: string;
  error?: string;
  hint?: string;
}

function FieldInput({
  id,
  label,
  error,
  hint,
  'aria-describedby': describedBy,
  ...props
}: FieldProps) {
  const helpId = error || hint ? `register-${id}-help` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={`register-${id}`}>{label}</label>
      <input
        {...props}
        name={id}
        id={`register-${id}`}
        aria-invalid={Boolean(error)}
        aria-describedby={[helpId, describedBy].filter(Boolean).join(' ') || undefined}
      />
      {(error || hint) && (
        <p id={helpId} className={error ? styles.fieldError : styles.fieldHint}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

function otpDigits(value: string) {
  return value.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
}

function OtpField({
  entryRef,
  value,
  onChange,
  disabled,
  checking,
  verified,
  error,
  hasRequestError,
}: {
  entryRef: React.Ref<HTMLDivElement>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  checking: boolean;
  verified: boolean;
  error?: string;
  hasRequestError: boolean;
}) {
  const [caret, setCaret] = useState<number | null>(null);
  const activeSlot = caret === null ? null : Math.min(caret, value.length, OTP_LENGTH - 1);

  function readCaret(input: HTMLInputElement) {
    setCaret(input.selectionStart ?? input.value.length);
  }

  function updateCode(input: HTMLInputElement) {
    const code = otpDigits(input.value);
    if (input.value !== code) {
      const cursor = input.selectionStart ?? input.value.length;
      const position = otpDigits(input.value.slice(0, cursor)).length;
      input.value = code;
      input.setSelectionRange(position, position);
    }
    onChange(code);
    readCaret(input);
  }

  function pasteCode(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    if (checking || verified) return;
    const input = event.currentTarget;
    const digits = otpDigits(event.clipboardData.getData('text'));
    if (!digits) return;
    const wholeCode = digits.length === OTP_LENGTH;
    const start = wholeCode ? 0 : (input.selectionStart ?? input.value.length);
    const end = wholeCode ? input.value.length : (input.selectionEnd ?? start);
    const space = OTP_LENGTH - (input.value.length - (end - start));
    if (space <= 0) return;
    input.setRangeText(digits.slice(0, space), start, end, 'end');
    updateCode(input);
  }

  function selectSlot(event: React.MouseEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const { left, width } = input.getBoundingClientRect();
    if (event.detail !== 1 || width === 0) return;
    const slot = Math.floor(((event.clientX - left) / width) * OTP_LENGTH);
    const start = Math.max(0, Math.min(slot, input.value.length, OTP_LENGTH - 1));
    input.setSelectionRange(start, Math.min(start + 1, input.value.length));
    readCaret(input);
  }

  return (
    <div className={styles.field}>
      <label htmlFor="register-code">Mã OTP</label>
      <div
        ref={entryRef}
        className={styles.otpEntry}
        data-invalid={Boolean(error)}
        data-disabled={disabled || checking || verified}
        data-verified={verified ? true : undefined}
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <span
            key={index}
            className={styles.otpSlot}
            aria-hidden="true"
            data-active={activeSlot === index ? true : undefined}
          >
            {value[index]}
          </span>
        ))}
        <input
          className={styles.otpInput}
          id="register-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={OTP_LENGTH}
          required
          disabled={disabled}
          readOnly={checking || verified}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={
            hasRequestError ? 'register-code-help register-otp-error' : 'register-code-help'
          }
          onChange={(event) => updateCode(event.currentTarget)}
          onPaste={pasteCode}
          onClick={selectSlot}
          onFocus={(event) => readCaret(event.currentTarget)}
          onSelect={(event) => readCaret(event.currentTarget)}
          onBlur={() => setCaret(null)}
        />
      </div>
      <p id="register-code-help" className={error ? styles.fieldError : styles.fieldHint}>
        {error}
      </p>
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
  const [pendingAction, setPendingAction] = useState<AuthAction | null>(null);
  const otpAccepted = step === 'otp' && ticket !== null;
  const loading = pendingAction !== null || otpAccepted;
  const checkingOtp = step === 'otp' && pendingAction === 'verify' && !otpAccepted;
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const otpEntry = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const autoVerifyTimer = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(autoVerifyTimer.current);
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!otpAccepted) return;
    const advance = () => {
      setValues((current) => ({ ...current, code: '' }));
      setStep('password');
    };
    const animations = otpEntry.current?.getAnimations?.({ subtree: true }) ?? [];
    if (animations.length === 0) {
      advance();
      return;
    }

    let active = true;
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (active) advance();
    });
    return () => {
      active = false;
    };
  }, [otpAccepted]);
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

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  }
  const change = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) =>
    updateField(field, event.target.value);
  function invalid(next: Errors): boolean {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (!first) return false;
    (form.current?.elements.namedItem(first) as HTMLInputElement | null)?.focus();
    return true;
  }
  function cancelAutoVerify() {
    clearTimeout(autoVerifyTimer.current);
    autoVerifyTimer.current = undefined;
  }
  function resetVerification() {
    cancelAutoVerify();
    setTicket(null);
    setValues((current) => ({ ...current, code: '', password: '', confirmPassword: '' }));
    setErrors({});
    setError('');
    setNotice('');
    setShowPassword(false);
  }
  async function run(action: AuthAction, work: (signal: AbortSignal) => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPendingAction(action);
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
      if (mounted.current) setPendingAction(null);
    }
  }
  async function sendOtp() {
    if (otpAccepted) return;
    cancelAutoVerify();
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
  async function verifyOtp(code: string) {
    cancelAutoVerify();
    if (busy.current || otpAccepted) return;
    if (
      invalid(code.length !== OTP_LENGTH ? { code: 'Vui lòng nhập đủ 6 chữ số của mã OTP.' } : {})
    )
      return;
    await run('verify', async (signal) => {
      const result = await client.verifyOtp({ email: values.email, code }, signal);
      if (!mounted.current || signal.aborted) return;
      setTicket({ ...result, expiresAt: Date.now() + result.expiresIn * 1000 });
      setErrors({});
    });
  }
  function changeOtp(code: string) {
    if (busy.current || otpAccepted || code === values.code) return;
    cancelAutoVerify();
    updateField('code', code);
    if (code.length === OTP_LENGTH) {
      autoVerifyTimer.current = setTimeout(() => {
        void verifyOtp(code);
      }, OTP_AUTOVERIFY_DELAY_MS);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || otpAccepted) return;
    if (step === 'email') {
      await sendOtp();
      return;
    }
    if (step === 'otp') {
      await verifyOtp(values.code);
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
  const steps: { key: Step; label: string }[] = [
    { key: 'email', label: 'Email trường' },
    { key: 'otp', label: 'OTP' },
    { key: 'password', label: 'Mật khẩu' },
  ];
  const currentStepIndex = steps.findIndex(({ key }) => key === step);
  const titles: Record<Step, string> = {
    email: 'Tạo tài khoản sinh viên',
    otp: 'Xác thực email',
    password: 'Tạo mật khẩu',
  };
  return (
    <>
      <ol className={styles.steps} aria-label="Tiến trình đăng ký">
        {steps.map(({ key, label }, index) => (
          <li
            key={key}
            aria-current={step === key ? 'step' : undefined}
            data-complete={index < currentStepIndex ? true : undefined}
          >
            <span aria-hidden="true">{index < currentStepIndex ? '✓' : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <h1 ref={heading} tabIndex={-1} className={styles.formTitle}>
        {titles[step]}
      </h1>
      <p className={styles.formDescription}>
        {step === 'email'
          ? 'Tham gia cộng đồng bằng email trường của bạn.'
          : step === 'otp'
            ? 'Nhập mã xác thực đã gửi đến email bên dưới.'
            : 'Hãy chọn tên hiển thị và mật khẩu cho tài khoản của bạn.'}
      </p>
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
      {(checkingOtp || otpAccepted) && (
        <p className={otpAccepted ? styles.otpAnnouncement : styles.otpFeedback} role="status">
          {otpAccepted ? 'Mã OTP hợp lệ.' : 'Đang xác thực mã OTP…'}
        </p>
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
          <OtpField
            entryRef={otpEntry}
            value={values.code}
            disabled={pendingAction === 'request'}
            checking={checkingOtp}
            verified={otpAccepted}
            onChange={changeOtp}
            error={errors.code}
            hasRequestError={Boolean(error)}
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
            <label className={styles.passwordVisibility}>
              <input
                type="checkbox"
                checked={showPassword}
                disabled={loading}
                onChange={(event) => setShowPassword(event.currentTarget.checked)}
              />
              Hiện mật khẩu
            </label>
          </>
        )}
        {notice && (
          <p className={styles.infoNotice} role="status">
            {notice}
          </p>
        )}
        {error && (
          <p
            className={styles.errorNotice}
            id={step === 'otp' ? 'register-otp-error' : undefined}
            role="alert"
          >
            {error}
          </p>
        )}
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
        <button className={styles.submitButton} type="submit" disabled={loading}>
          {pendingAction ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              {step === 'otp' ? 'Xác thực OTP' : 'Đang xử lý…'}
            </>
          ) : step === 'email' ? (
            'Gửi mã xác thực'
          ) : step === 'otp' ? (
            'Xác thực OTP'
          ) : (
            'Tạo tài khoản'
          )}
        </button>
      </form>
      <p className={styles.switchForm}>
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </>
  );
}
