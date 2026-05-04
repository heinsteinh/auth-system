import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '../auth/api';
import { AuthCard, Field, FormError, FormSuccess, SubmitButton } from './shared';
import { getApiErrorMessage } from './apiError';

const schema = z
  .object({
    password: z.string().min(12, 'Password must be at least 12 characters'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthCard title="Reset password">
        <FormError message="Missing reset token. Use the link from your email." />
        <div className="mt-4 text-sm text-slate-600">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSuccess(null);

    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as 'password' | 'confirm'] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await authApi.resetPassword(token, parsed.data.password);
      setSuccess('Password reset. Redirecting to sign in...');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Reset failed. The link may be expired.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Reset password">
      <FormSuccess message={success} />
      <FormError message={serverError} />
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <SubmitButton loading={loading}>Reset password</SubmitButton>
      </form>
    </AuthCard>
  );
}
