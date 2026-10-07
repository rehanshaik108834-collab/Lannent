import { useEffect } from 'react';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './superuser-create-task.css?inline';

/*
 * The original page opens with:
 *
 *   // Superuser is no longer permitted to create tasks — redirect to dashboard.
 *   no session        -> login.html
 *   superuser         -> superuser-dashboard.html
 *   any other role    -> that role's dashboard
 *
 * Every visitor is redirected before the form is built, so the task form,
 * milestone editor and summary that follow it in the original script never
 * render. Only the redirect is ported; the page draws nothing.
 */
export default function SuperuserCreateTask() {
  usePageStyle(css);

  useEffect(() => {
    const session = Auth.getCurrentUser();
    if (!session) { go('login.html'); return; }
    if (session.role === 'superuser') { go('superuser-dashboard.html'); return; }
    go(Auth.getDashboardUrl(session.role));
  }, []);

  return null;
}
