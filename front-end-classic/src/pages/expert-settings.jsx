import { useRef, useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './expert-settings.css?inline';

const DOMAINS = [
  { id: 'frontend', label: 'Frontend Development', sub: 'React, Vue, Angular, HTML/CSS', icon: 'monitor' },
  { id: 'backend', label: 'Backend Development', sub: 'Node.js, Python, REST APIs', icon: 'server' },
  { id: 'mobile', label: 'Mobile Apps', sub: 'iOS, Android, React Native', icon: 'smartphone' },
  { id: 'devops', label: 'DevOps & Cloud', sub: 'Docker, CI/CD, AWS, GCP', icon: 'cloud' },
  { id: 'database', label: 'Database Architecture', sub: 'SQL, NoSQL, schema design', icon: 'database' },
  { id: 'security', label: 'Security & Auditing', sub: 'Penetration testing, OWASP', icon: 'shield' },
  { id: 'ai', label: 'AI / ML Systems', sub: 'Model pipelines, data workflows', icon: 'cpu' },
  { id: 'sysdesign', label: 'System Design', sub: 'Architecture, scalability', icon: 'git-branch' },
];

const NAV = [
  { sec: 'profile', icon: 'user', label: 'Profile' },
  { sec: 'availability', icon: 'clock', label: 'Availability' },
  { sec: 'domains', icon: 'layers', label: 'Audit Domains' },
];

/**
 * Saves profile fields and reports the server's answer. Returns true only
 * when the server stored them; otherwise shows why and returns false.
 */
function persistProfile(updates) {
  const session = Auth.getCurrentUser();
  if (!session) { Validate.toast('Your session has ended. Sign in again.', 'error'); return false; }
  const result = Store.saveProfile(session.userId, updates);
  if (!result.ok) { Validate.toast(result.message || 'Could not save. Please try again.', 'error'); return false; }
  if (updates.name) {
    try { localStorage.setItem('lannent_session', JSON.stringify({ ...session, name: updates.name })); } catch (e) { /* ignore */ }
  }
  return true;
}

function loadUser() {
  const session = Auth.getCurrentUser();
  return session ? Store.getUserById(session.userId) : null;
}

export default function ExpertSettings() {
  usePageStyle(css);
  const [user] = useState(loadUser);
  const v = useFieldErrors();
  const [section, setSection] = useState('profile');
  const fnameRef = useRef(null);
  const lnameRef = useRef(null);
  const emailRef = useRef(null);
  const bioRef = useRef(null);
  const statusRef = useRef(null);
  const maxRef = useRef(null);
  const typeRef = useRef(null);

  const profile = user ? {
    name: user.name || '',
    email: user.email || '',
    bio: user.bio || '',
    avatarColor: user.avatarColor || 'linear-gradient(135deg, #a855f7, #7c3aed)',
  } : null;
  const [initials, setInitials] = useState(() => (profile ? (profile.name.substring(0, 2) || 'RS').toUpperCase() : ''));
  // Which domain cards are on, in page order.
  const [domainOn, setDomainOn] = useState(() => {
    const storedDomains = (user && user.auditDomains) || ['frontend', 'backend', 'security'];
    return DOMAINS.map((d) => storedDomains.includes(d.id));
  });

  if (!user) {
    // Bailing here used to leave a genuinely blank page.
    return (
      <EmptyState
        role="expert"
        activePath="expert-settings.html"
        pageTitle="Settings"
        message="Your profile could not be loaded. Check that the API is running, then reload."
        linkHref="expert-dashboard.html"
        linkLabel="Back to Dashboard"
      />
    );
  }

  const nameParts = profile.name.split(' ');
  const fname = nameParts[0] || 'Ramesh';
  const lname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Subramaniam';
  const availability = user.availability || { status: 'Actively accepting cases', maxCases: '2', type: 'Both — Audits & Disputes' };

  const show = (e, sec) => {
    e.preventDefault();
    setSection(sec);
  };
  const secStyle = (sec) => (section === sec ? undefined : { display: 'none' });

  const toggleDomain = (i) => setDomainOn((list) => list.map((on, j) => (j === i ? !on : on)));

  function saveExpertProfile() {
    const fn = fnameRef.current?.value.trim() || '';
    const ln = lnameRef.current?.value.trim() || '';
    const email = emailRef.current?.value.trim() || '';
    const bio = bioRef.current?.value.trim() || '';

    const { valid } = v.form([
      { fieldId: 'es-fname', value: fn, checks: [(val) => Validate.required(val, 'First name')] },
      { fieldId: 'es-lname', value: ln, checks: [(val) => Validate.required(val, 'Last name')] },
      { fieldId: 'es-email', value: email, checks: [Validate.email] },
    ]);
    if (!valid) return;

    if (!persistProfile({ name: fn + ' ' + ln, bio })) return;
    Validate.toast('Profile saved successfully!', 'success');

    setInitials(((fn.charAt(0) || '') + (ln.charAt(0) || '')).toUpperCase());
  }

  function saveAvailability() {
    const status = statusRef.current?.value || '';
    const maxCases = maxRef.current?.value || '';
    const type = typeRef.current?.value || '';

    if (!persistProfile({ availability: { status, maxCases, type } })) return;
    Validate.toast('Availability preferences saved!', 'success');
  }

  function saveDomains() {
    const selectedIds = DOMAINS.filter((d, i) => domainOn[i]).map((d) => d.id);

    if (!persistProfile({ auditDomains: selectedIds })) return;
    Validate.toast('Audit domains updated successfully!', 'success');
  }

  // The original marked the matching <option selected>; none matching leaves the first.
  const statusDefault = ['Actively accepting cases', 'Available — selective only', 'Unavailable'].find((o) => availability.status === o);
  const maxDefault = ['1', '2', '3', '4+'].find((o) => availability.maxCases === o);
  const typeDefault = ['Both — Audits & Disputes', 'Technical Audits only', 'Conflict Resolution only'].find((o) => availability.type === o);

  return (
    <DashboardLayout
      role="expert"
      activePath="expert-settings.html"
      pageTitle="Settings"
      pageSubtitle="Manage your reviewer profile and preferences"
    >
      <div className="settings-layout">

        {/* Side nav */}
        <nav className="settings-nav">
          {NAV.map((n) => (
            <a key={n.sec} href="#" className={'settings-nav-item' + (section === n.sec ? ' active' : '')} onClick={(e) => show(e, n.sec)}>
              <Icon name={n.icon} style={{ width: 15, height: 15 }} />{` ${n.label}`}
            </a>
          ))}
        </nav>

        <div>

          {/* PROFILE */}
          <div id="sec-profile" style={secStyle('profile')}>
            <div className="settings-card">
              <h3>Expert Profile</h3>

              <div className="avatar-row">
                <div className="avatar-circle" style={{ background: profile.avatarColor }}>{initials}</div>
                <div>
                  <button className="btn-save" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => Validate.toast('Avatar upload feature disabled in demo', 'warning')}>Change Photo</button>
                  <div className="avatar-info" style={{ marginTop: 5 }}>JPG or PNG · Max 2 MB</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" defaultValue={fname} id="es-fname" ref={fnameRef} style={v.fieldStyle('es-fname')} />
                  {v.error('es-fname')}
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" defaultValue={lname} id="es-lname" ref={lnameRef} style={v.fieldStyle('es-lname')} />
                  {v.error('es-lname')}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" defaultValue={profile.email} id="es-email" readOnly title="Email changes are not available yet." ref={emailRef} style={v.fieldStyle('es-email')} />
                {v.error('es-email')}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Reviewer ID</label>
                  <input type="text" className="form-input" defaultValue={`EXP-2024-${user.id.substring(user.id.length - 4)}`} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input type="text" className="form-input" defaultValue="Expert Reviewer" readOnly />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="form-input" rows="3" id="es-bio" defaultValue={profile.bio} ref={bioRef} />
                <div className="form-hint">Shown to Clients and Gig Workers when assigned to their case.</div>
              </div>

              <button className="btn-save" onClick={saveExpertProfile}>
                <Icon name="save" style={{ width: 13, height: 13 }} />{' Save Profile'}
              </button>
            </div>
          </div>

          {/* AVAILABILITY */}
          <div id="sec-availability" style={secStyle('availability')}>
            <div className="settings-card">
              <h3>Availability</h3>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" id="es-avail-status" defaultValue={statusDefault} ref={statusRef}>
                  <option>Actively accepting cases</option>
                  <option>Available — selective only</option>
                  <option>Unavailable</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Max Concurrent Cases</label>
                <select className="form-input" id="es-avail-max" defaultValue={maxDefault} ref={maxRef}>
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4+</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Case Type</label>
                <select className="form-input" id="es-avail-type" defaultValue={typeDefault} ref={typeRef}>
                  <option>Both — Audits &amp; Disputes</option>
                  <option>Technical Audits only</option>
                  <option>Conflict Resolution only</option>
                </select>
              </div>

              <button className="btn-save" onClick={saveAvailability}>
                <Icon name="save" style={{ width: 13, height: 13 }} />{' Save Availability'}
              </button>
            </div>
          </div>

          {/* DOMAINS */}
          <div id="sec-domains" style={secStyle('domains')}>
            <div className="settings-card">
              <h3>Audit Domains</h3>
              <p className="domains-summary">
                <span id="domain-count">{domainOn.filter(Boolean).length}</span>{` of ${DOMAINS.length} domains selected — you will only receive audit requests matching these. `}
              </p>
              <div className="domain-grid">
                {DOMAINS.map((d, i) => (
                  <div key={d.id} className={`domain-card ${domainOn[i] ? 'on' : 'off'}`} onClick={() => toggleDomain(i)} data-id={d.id}>
                    <div className="domain-card-icon"><Icon name={d.icon} /></div>
                    <div>
                      <div className="domain-card-title">{d.label}</div>
                      <div className="domain-card-sub">{d.sub}</div>
                    </div>
                    <div className="domain-check"><div className="domain-check-dot" /></div>
                  </div>
                ))}
              </div>
              <button className="btn-save" onClick={saveDomains}>
                <Icon name="save" style={{ width: 13, height: 13 }} />{' Save Domains'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
