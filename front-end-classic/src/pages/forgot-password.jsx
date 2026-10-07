import { useState } from 'react';
import Icon from '../components/Icon';
import A from '../components/A';
import { Validate, useFieldErrors } from '../lib/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const v = useFieldErrors();

  const onSubmit = (e) => {
    e.preventDefault();
    const emailVal = email.trim();
    const { valid } = v.form([
      { fieldId: 'forgotEmail', value: emailVal, checks: [Validate.email] },
    ]);
    if (!valid) return;
    setSent(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#f8f7ff 0%,#f0edff 100%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <A href="../index.html" style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>Lannent<span style={{ color: '#f43f5e' }}>.</span></A>
        </div>
        <div id="step1Card" className="auth-card" style={sent ? { display: 'none' } : undefined}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="key" style={{ color: 'white', width: 24, height: 24 }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Forgot your password?</h2>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>No problem. Enter your email and we&apos;ll send you a reset link.</p>
          </div>
          <form id="forgotForm" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email" className="form-input" placeholder="you@example.com" id="forgotEmail"
                style={v.fieldStyle('forgotEmail')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); v.clearError('forgotEmail'); }}
              />
              {v.error('forgotEmail')}
            </div>
            <button type="submit" className="btn-submit">Send Reset Link</button>
          </form>
          <p className="auth-footer-text"><A href="login.html">← Back to login</A></p>
        </div>
        <div id="step2Card" className="auth-card" style={{ display: sent ? 'block' : 'none', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="mail" style={{ color: 'white', width: 32, height: 32 }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Check your email</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>We&apos;ve sent a password reset link to your email address. Check your inbox (and spam folder).</p>
          <A href="login.html" className="btn-primary" style={{ display: 'block', padding: 12, borderRadius: 12, textAlign: 'center', textDecoration: 'none' }}>Back to Login</A>
        </div>
      </div>
    </div>
  );
}
