import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import type { Role } from '../../shared/types/auth';
import { dashboards } from './registry';

export function SessionStatus() {
  const { status, error, retry, logout } = useAuth();
  return (
    <main className="status">
      <h1>
        {status === 'loading'
          ? 'Checking your session…'
          : 'Unable to verify your session'}
      </h1>
      {status === 'loading' ? (
        <p role="status">Please wait.</p>
      ) : (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => void retry()}>Try again</button>{' '}
          <button onClick={logout}>Sign out</button>
        </>
      )}
    </main>
  );
}
export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: readonly Role[];
  children: ReactNode;
}) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'error') return <SessionStatus />;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  if (roles && !roles.includes(user.role))
    return (
      <main className="status">
        <h1>Access restricted</h1>
        <p>Your account does not have access to this page.</p>
        <Link to={dashboards[user.role]}>Go to your dashboard</Link>
      </main>
    );
  return children;
}
export function DashboardRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={dashboards[user.role]} replace /> : null;
}
