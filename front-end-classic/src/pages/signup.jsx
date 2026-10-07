import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { Validate, useFieldErrors } from '../lib/validation';

// Requirements checklist under the password field
const PW_REQS = [
  { id: 'reqLen', text: 'At least 8 characters', test: (val) => val.length >= 8 },
  { id: 'reqUpper', text: 'One uppercase letter', test: (val) => /[A-Z]/.test(val) },
  { id: 'reqLower', text: 'One lowercase letter', test: (val) => /[a-z]/.test(val) },
  { id: 'reqNum', text: 'One number', test: (val) => /\d/.test(val) },
  { id: 'reqSpecial', text: 'One special character (!@#$%^&*)', test: (val) => /[!@#$%^&*]/.test(val) },
];

const FIELD_IDS = ['signupName', 'signupEmail', 'signupPw', 'signupConfirm'];

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  // Visual state classes (input-error / input-success) per field
  const [cls, setCls] = useState({});
  // Role error: the outline stays once set (the original never removed it); the message goes on selectRole
  const [roleOutline, setRoleOutline] = useState(false);
  const [roleErr, setRoleErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const v = useFieldErrors();
  // lucide.createIcons() (run by the eye toggles) replaced EVERY icon element on
  // the page with a fresh <svg>; remounting the icons (new keys) reproduces that.
  const [iconGen, setIconGen] = useState(0);
  const createIcons = () => setIconGen((n) => n + 1);

  // If already logged in, redirect
  useEffect(() => {
    if (Auth.isLoggedIn()) go(Auth.getDashboardUrl(Auth.getCurrentUser().role));
  }, []);

  const setFieldCls = (id, c) => setCls((s) => ({ ...s, [id]: c }));
  const inputCls = (base, id) => (cls[id] ? `${base} ${cls[id]}` : base);

  const selectRole = (role) => {
    setSelectedRole(role);
    setRoleErr(false);
  };

  // ── Real-time password validation ──
  const onPwInput = (val) => {
    setPw(val);
    if (val.length === 0) {
      setFieldCls('signupPw', '');
      return;
    }
    // Clear previous validation error while typing
    v.clearError('signupPw');
    setFieldCls('signupPw', '');
  };

  // ── Real-time fullName validation ──
  const onNameInput = (raw) => {
    setName(raw);
    v.clearError('signupName');
    const val = raw.trim();
    let c = '';
    if (val.length !== 0) {
      const err = Validate.fullName(val);
      if (!err && val.length >= 3) c = 'input-success';
    }
    setFieldCls('signupName', c);
  };

  // ── Real-time email validation ──
  const onEmailInput = (raw) => {
    setEmail(raw);
    v.clearError('signupEmail');
    const val = raw.trim();
    let c = '';
    if (val.length !== 0) {
      const err = Validate.email(val);
      if (!err) c = 'input-success';
    }
    setFieldCls('signupEmail', c);
  };

  // ── Real-time confirm password ──
  const onConfirmInput = (val) => {
    setConfirm(val);
    v.clearError('signupConfirm');
    let c = '';
    if (val.length !== 0) {
      if (pw && val === pw) c = 'input-success';
      else if (val.length > 0) c = 'input-error';
    }
    setFieldCls('signupConfirm', c);
  };

  // ── Signup form submission ──
  const onSubmit = (e) => {
    e.preventDefault();
    const nameVal = name.trim();
    const emailVal = email.trim();
    const pwVal = pw;
    const confirmVal = confirm;

    const { valid, errors } = v.form([
      { fieldId: 'signupName', value: nameVal, checks: [Validate.fullName] },
      { fieldId: 'signupEmail', value: emailVal, checks: [Validate.email] },
      { fieldId: 'signupPw', value: pwVal, checks: [Validate.password] },
      { fieldId: 'signupConfirm', value: confirmVal, checks: [(val) => Validate.passwordMatch(pwVal, val)] },
    ]);

    // Clear all visual states, then mark error fields
    const next = {};
    FIELD_IDS.forEach((id) => { next[id] = errors[id] ? 'input-error' : ''; });
    setCls(next);

    // Role check
    if (!selectedRole) {
      setRoleOutline(true);
      setRoleErr(true);
      if (valid) return;
    }
    if (!valid || !selectedRole) return;

    // Check if email already exists
    const existing = Store.getUserByEmail(emailVal);
    if (existing) { v.showError('signupEmail', 'An account with this email already exists.'); return; }

    setSubmitting(true);
    setTimeout(() => {
      const initials = nameVal.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
      const colors = { client: 'linear-gradient(135deg,#6366f1,#4f46e5)', worker: 'linear-gradient(135deg,#10b981,#059669)' };
      Store.createUser({ name: nameVal, email: emailVal, password: pwVal, role: selectedRole, avatar: initials, avatarColor: colors[selectedRole] || '' });
      const result = Auth.login(emailVal, pwVal);
      if (result.success) {
        go(Auth.getDashboardUrl(selectedRole));
      } else {
        setSubmitting(false);
      }
    }, 400);
  };

  // Strength indicator
  const { label, level } = Validate.passwordStrength(pw);
  const barCls = level === 1 ? 'active-weak' : level === 2 ? 'active-medium' : 'active-strong';
  const pwShown = pw.length !== 0;

  return (
    <div className="auth-page">
      {/* Background video (fixed height so it doesn't zoom on tall pages) */}
      <div className="auth-video-wrap" style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <video className="auth-video" autoPlay muted loop playsInline>
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085640_276ea93b-d7da-4418-a09b-2aa5b490e838.mp4" type="video/mp4" />
        </video>
        <div className="auth-overlay" />
      </div>

      {/* LEFT — Branding */}
      <div className="auth-left" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <h1 className="auth-title">Build projects with <span className="serif">confidence</span>.</h1>
        <p className="auth-sub">Hire skilled gig workers, collaborate in real-time, and release secure escrow payments only when milestones are approved.</p>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="lock" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Escrow-secured payments</span>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="file-check" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Expert technical audits</span>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="handshake" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Milestone-based collaboration</span>
          </div>
        </div>
      </div>

      {/* RIGHT — Signup Form */}
      <div className="auth-right" style={{ position: 'relative', zIndex: 1, alignItems: 'flex-start', paddingTop: 48, paddingBottom: 48 }}>
        <div className="auth-card">
          <div className="auth-card-brand">
            <Icon key={iconGen} name="shield-check" style={{ width: 20, height: 20 }} />
            <span className="auth-card-brand-name">GigBoard</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 24, marginBottom: 4 }}>Create your account</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>Get started with your first project</p>

          <form id="signupForm" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text" className={inputCls('form-input', 'signupName')} placeholder="John Doe" id="signupName"
                style={v.fieldStyle('signupName')}
                value={name}
                onChange={(e) => onNameInput(e.target.value)}
              />
              {v.error('signupName')}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email" className={inputCls('form-input', 'signupEmail')} placeholder="you@example.com" id="signupEmail"
                style={v.fieldStyle('signupEmail')}
                value={email}
                onChange={(e) => onEmailInput(e.target.value)}
              />
              {v.error('signupEmail')}
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="form-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} className={inputCls('form-input form-input-pr', 'signupPw')} placeholder="••••••••" id="signupPw"
                  style={v.fieldStyle('signupPw')}
                  value={pw}
                  onChange={(e) => onPwInput(e.target.value)}
                />
                {v.error('signupPw')}
                <button type="button" className="form-input-icon-right" id="togglePw" onClick={() => { setShowPw((s) => !s); createIcons(); }}>
                  <Icon key={iconGen} name={showPw ? 'eye-off' : 'eye'} style={{ width: 16, height: 16 }} />
                </button>
              </div>
              {/* Password strength indicator */}
              <div className="pw-strength" id="pwStrengthWrap" style={{ display: pwShown ? '' : 'none' }}>
                <div className="pw-strength-bars">
                  {[1, 2, 3].map((n, i) => (
                    <div key={n} className={'pw-strength-bar' + (pwShown && i < level ? ` ${barCls}` : '')} id={`pwBar${n}`} />
                  ))}
                </div>
                {' '}
                <span className={pwShown ? 'pw-strength-label ' + label.toLowerCase() : 'pw-strength-label'} id="pwStrengthLabel">{pwShown ? label : ''}</span>
              </div>
              {/* Requirements checklist */}
              <div className="pw-requirements" id="pwRequirements" style={{ display: pwShown ? '' : 'none' }}>
                {PW_REQS.map((r) => (
                  <div key={r.id} className={pwShown && r.test(pw) ? 'pw-req met' : 'pw-req'} id={r.id}><span className="pw-req-icon">✓</span><span>{r.text}</span></div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="form-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'} className={inputCls('form-input form-input-pr', 'signupConfirm')} placeholder="••••••••" id="signupConfirm"
                  style={v.fieldStyle('signupConfirm')}
                  value={confirm}
                  onChange={(e) => onConfirmInput(e.target.value)}
                />
                {v.error('signupConfirm')}
                <button type="button" className="form-input-icon-right" id="toggleConfirm" onClick={() => { setShowConfirm((s) => !s); createIcons(); }}>
                  <Icon key={iconGen} name={showConfirm ? 'eye-off' : 'eye'} style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* Role Selection */}
            <div className="form-group">
              <label className="form-label">I want to</label>
              <div className="role-grid" id="roleGroup" style={roleOutline ? { outline: '2px solid #ef4444', borderRadius: 12 } : undefined}>
                <button type="button" className={selectedRole === 'client' ? 'role-card active' : 'role-card'} id="roleClient" onClick={() => selectRole('client')}>
                  <div className="role-card-icon"><Icon key={iconGen} name="clipboard-list" style={{ width: 20, height: 20 }} /></div>
                  <p className="role-card-title">Client</p>
                  <p className="role-card-desc">Post tasks and hire gig workers</p>
                </button>
                <button type="button" className={selectedRole === 'worker' ? 'role-card active' : 'role-card'} id="roleWorker" onClick={() => selectRole('worker')}>
                  <div className="role-card-icon"><Icon key={iconGen} name="wrench" style={{ width: 20, height: 20 }} /></div>
                  <p className="role-card-title">Gig Worker</p>
                  <p className="role-card-desc">Find projects and submit deliverables</p>
                </button>
              </div>
              {roleErr && <p id="roleGroup_err" style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>Please select a role to continue.</p>}
            </div>

            <button type="submit" className="btn-submit" style={{ marginTop: 4 }} disabled={submitting}>{submitting ? 'Creating account...' : 'Create Account'}</button>
          </form>

          <p className="auth-footer-text">
            Already have an account? <A href="login.html">Sign in</A>
          </p>
        </div>
      </div>
    </div>
  );
}
