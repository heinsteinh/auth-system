import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function UserDashboard() {
  const { user, logout, refreshMe } = useAuth();

  useEffect(() => {
    void refreshMe();

    const onFocus = () => {
      void refreshMe();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshMe]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Auth System</h1>
          <div className="flex items-center gap-4 text-sm">
            {user.role === 'ADMIN' ? (
              <Link to="/admin" className="text-indigo-600 hover:underline">
                Admin
              </Link>
            ) : null}
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Welcome back</h2>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-medium text-slate-900">Your account</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Name" value={user.name ?? '-'} />
            <Detail label="Email" value={user.email} />
            <Detail label="Role" value={user.role} />
            <Detail
              label="Email verified"
              value={
                <span
                  className={
                    user.isEmailVerified ? 'text-green-700' : 'text-amber-700'
                  }
                >
                  {user.isEmailVerified ? 'Yes' : 'No'}
                </span>
              }
            />
            <Detail label="User ID" value={<code className="text-xs">{user.id}</code>} />
          </dl>
        </div>
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
