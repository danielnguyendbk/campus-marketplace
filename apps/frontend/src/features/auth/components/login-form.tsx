'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, authErrorMessage, type AuthApi } from '../api';
import { emailValidation, type AuthSession, type LoginBody } from '../types';
import { AuthModeNotice } from './auth-mode-notice';
import { SessionResult } from './session-result';
import styles from '../auth.module.css';

export function LoginForm({ client = authApi }: { client?: AuthApi }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginBody, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const body: LoginBody = { email: email.trim(), password };
    const errors: Partial<Record<keyof LoginBody, string>> = {};
    const emailError = emailValidation(body.email);
    if (emailError) errors.email = emailError;
    if (!body.password) errors.password = 'Vui lòng nhập mật khẩu.';
    setFieldErrors(errors);
    setError('');
    if (errors.email || errors.password) {
      (errors.email ? emailInput : passwordInput).current?.focus();
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const controller = new AbortController();
      request.current = controller;
      const result = await client.login(body, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setPassword('');
      setShowPassword(false);
      setSession(result);
      router.replace(result.user.verificationStatus === 'REJECTED' ? '/verification' : '/');
    } catch (requestError: unknown) {
      if (mounted.current && !request.current?.signal.aborted) {
        setError(authErrorMessage(requestError, 'login'));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  if (session)
    return (
      <>
        <AuthModeNotice mode={client.mode} />
        <SessionResult
          session={session}
          onReset={() => {
            client.clearSession();
            setSession(null);
            setEmail('');
            setFieldErrors({});
            setError('');
          }}
        />
      </>
    );

  return (
    <>
      <h1 className={styles.formTitle}>Đăng nhập</h1>
      <p className={styles.formDescription}>Sử dụng email trường đã đăng ký tài khoản.</p>

      <AuthModeNotice mode={client.mode} />
      <form
        className={styles.form}
        method="post"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={loading}
      >
        <div className={styles.field}>
          <label htmlFor="login-email">Email trường</label>
          <input
            ref={emailInput}
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="tenban@truong.edu.vn"
            value={email}
            disabled={loading}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
              setError('');
            }}
          />
          {fieldErrors.email && (
            <p className={styles.fieldError} id="login-email-error">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">Mật khẩu</label>
          <div className={styles.passwordField}>
            <input
              ref={passwordInput}
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
                setError('');
              }}
            />
            <button
              className={styles.passwordToggle}
              type="button"
              disabled={loading}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                {showPassword && <path d="m4 3 16 18" stroke="currentColor" strokeWidth="1.5" />}
              </svg>
            </button>
          </div>
          {fieldErrors.password && (
            <p className={styles.fieldError} id="login-password-error">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {error && (
          <div className={styles.errorNotice} role="alert">
            {error}
          </div>
        )}

        <button className={styles.submitButton} type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Đang đăng nhập…
            </>
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>

      <p className={styles.switchForm}>
        Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link>
      </p>
    </>
  );
}
