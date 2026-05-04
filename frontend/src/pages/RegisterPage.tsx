import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { AuthCard, Field, FormError, FormSuccess, SubmitButton } from './shared';
import { getApiErrorMessage } from './apiError';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional().or(z.literal('')),
});

export function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSuccess(null);

    const parsed = schema.safeParse({ email, password, name: name.trim() || undefined });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof typeof next] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await register({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name || undefined,
      });
      setSuccess('Account created. Check your inbox to verify your email.');
      setEmail('');
      setPassword('');
      setName('');
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Create account">
      <FormSuccess message={success} />
      <FormError message={serverError} />
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Name (optional)"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
