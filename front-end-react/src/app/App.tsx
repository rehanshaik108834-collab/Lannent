import { LegacyPage } from './routes/LegacyPage';
import { Route, Routes } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import {
  LandingPage,
  NotFoundPage,
  UnavailablePage,
} from '../features/public/PublicPages';
import { PortalLayout } from './layouts/PortalLayout';
import { DashboardRedirect, ProtectedRoute } from './routes/ProtectedRoute';
import { pageFor } from './routes/pages';
import { portalRoutes } from './routes/registry';

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Routes>
        <Route path="/pages/:file" element={<LegacyPage />} />
        <Route path="/index.html" element={<LegacyPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage register />} />
        <Route path="/expert-login" element={<AuthPage expert />} />
        <Route path="/expert-landing" element={<LandingPage expert />} />
        <Route path="/expert-signup" element={pageFor('/expert-signup')} />
        <Route path="/forgot-password" element={<UnavailablePage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />
        {portalRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute roles={route.roles}>
                <PortalLayout>{pageFor(route.path)}</PortalLayout>
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
