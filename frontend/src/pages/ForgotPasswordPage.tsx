import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '../auth/api';
import { AuthCard, Field, FormError, FormSuccess, SubmitButton } from './shared';
import { getApiErrorMessage } from './apiError';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setLoading(true);

    try {
      await authApi.forgotPassword(parsed.data.email);
      setSuccess('If that email is registered, a reset link has been sent.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send reset email'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Forgot password">
      <FormSuccess message={success} />
      <FormError message={error} />
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
        />
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
