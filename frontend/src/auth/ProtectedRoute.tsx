import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

type Props = {
  children: ReactNode;
  requireRole?: 'ADMIN' | 'USER';
};

export function ProtectedRoute({ children, requireRole }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
