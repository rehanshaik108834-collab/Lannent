import { useEffect } from 'react';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';

/*
 * The one admin desk became three, each landing on its own work. Anyone
 * holding an old bookmark is sent where their role actually belongs.
 *
 * The original page always took this redirect (Auth is always loaded), so the
 * stats and responsibility cards it built afterwards were never rendered; the
 * body stayed empty until the replace() navigation. That is kept here.
 */
export default function AdminDashboard() {
  useEffect(() => {
    const u = Auth.getCurrentUser();
    if (!u) { Auth.requireRole('revenue-admin'); return; }
    go(Auth.getDashboardUrl(u.role), { replace: true });
  }, []);

  return null;
}
