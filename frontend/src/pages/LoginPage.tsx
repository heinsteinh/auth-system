import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { AuthCard, Field, FormError, SubmitButton } from './shared';
import { getApiErrorMessage } from './apiError';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as 'email' | 'password'] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const user = await login(parsed.data.email, parsed.data.password);
      const target = from ?? (user.role === 'ADMIN' ? '/admin' : '/dashboard');
      navigate(target, { replace: true });
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Sign in">
      <FormError message={serverError} />
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
      <div className="mt-4 flex justify-between text-sm text-slate-600">
        <Link to="/register" className="text-indigo-600 hover:underline">
          Create account
        </Link>
        <Link to="/forgot-password" className="text-indigo-600 hover:underline">
          Forgot password?
        </Link>
      </div>
    </AuthCard>
  );
}
