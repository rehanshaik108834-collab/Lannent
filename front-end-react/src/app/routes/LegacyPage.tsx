import { NotFoundPage } from '../../features/public/PublicPages';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/auth-context';
import { SessionStatus } from './ProtectedRoute';
import { legacyFile, legacyRoutes } from './legacy-map';
import { resolveLegacy } from './legacy';
import { ErrorState, Loading } from '../../shared/ui/ui';
const publicDestinations = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/expert-landing',
  '/expert-login',
  '/expert-signup',
]);
export function LegacyPage() {
  const location = useLocation();
  const auth = useAuth();
  const template = legacyRoutes[legacyFile(location.pathname) ?? ''];
  const publicRoute = publicDestinations.has(template);
  const query = useQuery({
    queryKey: [
      'legacy-route',
      auth.user?.id,
      location.pathname,
      location.search,
    ],
    queryFn: () =>
      resolveLegacy(location.pathname, location.search, auth.user!.role),
    enabled: !publicRoute && auth.status === 'authenticated',
    retry: false,
  });
  if (!template || template === '*') return <NotFoundPage />;
  if (publicRoute) return <Navigate to={template} replace />;
  if (auth.status === 'loading' || auth.status === 'error')
    return <SessionStatus />;
  if (!auth.user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (query.isError)
    return (
      <main className="status">
        <ErrorState level={1} error={query.error} />
        <a href="/dashboard">Go to your dashboard</a>
      </main>
    );
  if (!query.data)
    return (
      <main className="status">
        <Loading label="Resolving the old link…" />
      </main>
    );
  return <Navigate to={query.data} replace />;
}
