import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, type AuthUser } from '../auth/api';
import { useAuth } from '../auth/useAuth';
import { FormError } from './shared';
import { getApiErrorMessage } from './apiError';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.listUsers();
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load users'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onDelete(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await authApi.deleteUser(id);
      setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete user'));
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleRole(target: AuthUser) {
    const next = target.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`Change ${target.email} to ${next}?`)) return;
    setBusyId(target.id);
    setError(null);
    try {
      const updated = await authApi.setUserRole(target.id, next);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change role'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Admin</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="text-indigo-600 hover:underline">
              My account
            </Link>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Users</h2>
          <span className="text-sm text-slate-500">Signed in as {user?.email}</span>
        </div>

        <FormError message={error} />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No users.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{u.email}</td>
                    <td className="px-4 py-3 text-slate-700">{u.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.role === 'ADMIN'
                            ? 'rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.isEmailVerified ? 'text-green-700' : 'text-amber-700'
                        }
                      >
                        {u.isEmailVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => onToggleRole(u)}
                          disabled={busyId === u.id || u.id === user?.id}
                          className="text-sm text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => onDelete(u.id)}
                          disabled={busyId === u.id || u.id === user?.id}
                          className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {busyId === u.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
