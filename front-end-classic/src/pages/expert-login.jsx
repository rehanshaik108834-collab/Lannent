import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './expert-login.css?inline';

function handleGoogleLogin() {
  Validate.toast('Social login is not available in demo mode.', 'info');
}

export default function ExpertLogin() {
  usePageStyle(css);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const v = useFieldErrors();
  // lucide.createIcons() (run by the eye toggles) replaced EVERY icon element on
  // the page with a fresh <svg>; remounting the icons (new keys) reproduces that.
  const [iconGen, setIconGen] = useState(0);
  const createIcons = () => setIconGen((n) => n + 1);

  useEffect(() => {
    if (Auth.isLoggedIn()) go(Auth.getDashboardUrl(Auth.getCurrentUser().role));
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const emailVal = email.trim();
    const pwVal = pw;

    const { valid } = v.form([
      { fieldId: 'expertEmail', value: emailVal, checks: [Validate.email] },
      { fieldId: 'expertPw', value: pwVal, checks: [(val) => Validate.required(val, 'Password')] },
    ]);
    if (!valid) return;

    setSubmitting(true);
    setTimeout(() => {
      // ── Check expert application status FIRST ──
      if (typeof Store !== 'undefined' && typeof Store.getExpertApplicationStatus === 'function') {
        const app = Store.getExpertApplicationStatus(emailVal);
        if (app.exists) {
          if (app.status === 'pending') {
            v.showError('expertEmail', 'Your application is under review. You will be notified once approved.');
            setSubmitting(false);
            return;
          }
          if (app.status === 'rejected') {
            v.showError('expertEmail', 'Your application was rejected. Please contact support for more information.');
            setSubmitting(false);
            return;
          }
          // status === 'approved' → proceed to auth
        }
      }

      const result = Auth.login(emailVal, pwVal);
      if (!result.success) {
        v.showError('expertEmail', result.error);
        setSubmitting(false);
        return;
      }
      // Ensure only experts can login through this page
      if (result.user.role !== 'expert') {
        v.showError('expertEmail', 'This login page is only for Expert Reviewers. Please use the appropriate login page.');
        Auth.logout();
        setSubmitting(false);
        return;
      }
      go(Auth.getDashboardUrl(result.user.role));
    }, 400);
  };

  return (
    <div className="auth-page">
      {/* Background video */}
      <div className="auth-video-wrap">
        <video className="auth-video" autoPlay muted loop playsInline>
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085640_276ea93b-d7da-4418-a09b-2aa5b490e838.mp4" type="video/mp4" />
        </video>
        <div className="auth-overlay" />
      </div>

      {/* LEFT — Branding */}
      <div className="auth-left">
        <h1 className="auth-title">Ensure quality with <span className="serif">expert</span> reviews.</h1>
        <p className="auth-sub">Access the audit dashboard to review technical deliverables, resolve disputes, and maintain quality standards across the platform.</p>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="file-check" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Technical audit dashboard</span>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="scale" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Dispute resolution panel</span>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon key={iconGen} name="lock" style={{ width: 15, height: 15 }} /></div>
            <span style={{ fontSize: 14 }}>Secure expert verification</span>
          </div>
        </div>
      </div>

      {/* RIGHT — Login Form */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-brand">
            <Icon key={iconGen} name="shield-check" style={{ width: 20, height: 20 }} />
            <span className="auth-card-brand-name">GigBoard</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 24, marginBottom: 4 }}>Expert Reviewer Login</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 32 }}>Access the audit dashboard to review deliverables and resolve disputes.</p>

          <form id="expertLoginForm" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email" className="form-input" placeholder="expert@example.com" id="expertEmail"
                style={v.fieldStyle('expertEmail')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); v.clearError('expertEmail'); }}
              />
              {v.error('expertEmail')}
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <A href="forgot-password.html" className="forgot-link">Forgot password?</A>
              </div>
              <div className="form-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} className="form-input form-input-pr" placeholder="••••••••" id="expertPw"
                  style={v.fieldStyle('expertPw')}
                  value={pw}
                  onChange={(e) => { setPw(e.target.value); v.clearError('expertPw'); }}
                />
                {v.error('expertPw')}
                <button type="button" className="form-input-icon-right" id="toggleExpertPw" onClick={() => { setShowPw((s) => !s); createIcons(); }}>
                  <Icon key={iconGen} name={showPw ? 'eye-off' : 'eye'} style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            <div className="remember-row">
              <input type="checkbox" id="rememberMe" />
              <label htmlFor="rememberMe">Remember me</label>
            </div>

            <button type="submit" className="btn-submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Login'}</button>
          </form>

          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or continue with</span>
            <div className="divider-line" />
          </div>

          <button className="btn-google" onClick={handleGoogleLogin}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Login with Google
          </button>

          <p className="auth-footer-text" style={{ marginTop: 32 }}>
            Want to join our network? <A href="expert-signup.html">Apply as Expert Reviewer</A>
          </p>
        </div>
      </div>
    </div>
  );
}
