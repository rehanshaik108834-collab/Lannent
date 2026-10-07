import { Navigate } from 'react-router-dom';

export { ExpertSignupPage } from './ExpertSignupPage';
export { IntakePage } from './IntakePage';

/** The duplicate operations route is retired; applications live on the intake desk. */
export const IntakeAliasPage = () => (
  <Navigate to="/admin/expert-applications" replace />
);
