import { useEffect, useRef } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { reload } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './staff-settings.css?inline';

// SuperUser and Admin previously had no settings page at all: the user menu
// sent them to profile-settings.html, which is client-guarded and bounced
// them straight back to their dashboard — an inescapable loop.
const SCOPES = {
  superuser: [
    'Manage user accounts — create, edit, suspend, delete',
    'Create and administer tasks across all clients',
    'Inspect escrow balances and the transaction ledger',
    'Review and override dispute verdicts',
  ],
  admin: [
    'Oversee the platform revenue model and fee configuration',
    'Review Expert Reviewer applications',
  ],
};

export default function StaffSettings() {
  usePageStyle(css);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const reloadTimer = useRef(null);
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  const session = Auth.getCurrentUser();
  const user = Store.getUserById(session.userId);
  if (!user) {
    return (
      <EmptyState
        role={session.role}
        activePath="staff-settings.html"
        pageTitle="Settings"
        message="Your account could not be loaded. Check that the API is running, then reload."
        linkHref={Auth.getDashboardUrl(session.role)}
        linkLabel="Back to Dashboard"
      />
    );
  }

  const scope = SCOPES[user.role] || [];

  const saveStaffProfile = () => {
    const current = Auth.getCurrentUser();
    const name = nameRef.current.value.trim();
    const email = emailRef.current.value.trim();

    if (name.length < 2) { Validate.toast('Enter a display name.', 'error'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Validate.toast('Enter a valid email address.', 'error'); return; }

    const result = Store.saveProfile(current.userId, { name });
    if (!result.ok) { Validate.toast(result.message || 'Could not save. Please try again.', 'error'); return; }

    // Keep the session in step so the top bar does not show a stale name.
    try {
      localStorage.setItem('lannent_session', JSON.stringify({ ...current, name, email }));
    } catch (e) {}
    Validate.toast('Settings saved.', 'success');
    reloadTimer.current = setTimeout(() => reload(), 700);
  };

  return (
    <DashboardLayout
      role={user.role}
      activePath="staff-settings.html"
      pageTitle="Settings"
      pageSubtitle="Your staff account"
    >
      <div className="ss-wrap">
        <div className="ss-card">
          <div className="ss-id">
            <div className="ss-avatar" style={{ background: user.avatarColor }}>{user.avatar}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 6 }}>{user.email}</div>
              <span className="ss-role">{user.role}</span>
            </div>
          </div>

          <div className="ss-field">
            <label htmlFor="ssName">Display name</label>
            <input id="ssName" className="form-input" type="text" defaultValue={user.name} ref={nameRef} />
          </div>
          <div className="ss-field">
            <label htmlFor="ssEmail">Email</label>
            <input id="ssEmail" className="form-input" type="email" defaultValue={user.email} readOnly title="Email changes are not available yet." ref={emailRef} />
          </div>
          <button className="btn-primary" onClick={saveStaffProfile}>Save changes</button>
        </div>

        <div className="ss-card">
          <h2>What this account can do</h2>
          <p className="hint">Staff permissions are fixed by role and cannot be edited here.</p>
          <ul className="ss-scope">
            {scope.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
