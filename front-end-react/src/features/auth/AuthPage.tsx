import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { signup } from './api';
import type { SignupRole } from '../../shared/types/auth';
import { destination } from '../../app/routes/registry';
import { SessionStatus } from '../../app/routes/ProtectedRoute';
import styles from './AuthPage.module.css';

export function AuthPage({
  register = false,
  expert = false,
}: {
  register?: boolean;
  expert?: boolean;
}) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const from =
    typeof location.state?.from === 'string' ? location.state.from : undefined;
  if (auth.status === 'loading' || auth.status === 'error')
    return <SessionStatus />;
  if (auth.user)
    return <Navigate to={destination(auth.user.role, from)} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    setError('');
    if (register && password !== form.get('confirmation')) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    try {
      if (register) {
        await signup({
          name: String(form.get('name')).trim(),
          email,
          password,
          role: form.get('role') as SignupRole,
        });
        navigate('/login', {
          replace: true,
          state: { notice: 'Account created. Sign in to continue.' },
        });
      } else {
        const user = await auth.login(email, password);
        navigate(destination(user.role, from), { replace: true });
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main" className={styles.layout}>
      <section className={styles.intro}>
        <Link className="brand" to="/">
          Lannent.
        </Link>
        <div>
          <p className="eyebrow">Work. Collaborate. Grow.</p>
          <h1>
            Build projects
            <br />
            with confidence.
          </h1>
          <p>
            Clear milestones, meaningful collaboration, and expert perspectives
            when you need them.
          </p>
        </div>
        <p>Great work begins with a shared understanding.</p>
      </section>
      <section className={styles.form}>
        <Link to="/">← Back home</Link>
        <h2>
          {register
            ? 'Create your account'
            : expert
              ? 'Expert sign in'
              : 'Welcome back'}
        </h2>
        <p>
          {register
            ? 'Choose how you would like to work with Lannent.'
            : 'Sign in to continue to your workspace.'}
        </p>
        {location.state?.notice && (
          <p role="status">{String(location.state.notice)}</p>
        )}
        <form
          onSubmit={submit}
          aria-label={register ? 'Create account' : 'Sign in'}
        >
          {register && (
            <label>
              Full name
              <input name="name" autoComplete="name" required maxLength={100} />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength={register ? 8 : undefined}
            />
          </label>
          {register && (
            <>
              <label>
                Confirm password
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label>
                I want to
                <select name="role" defaultValue="client">
                  <option value="client">Hire for a project</option>
                  <option value="worker">Find work</option>
                </select>
              </label>
              <p className={styles.hint}>
                Use at least 8 characters, including uppercase, lowercase, a
                number, and a special character.
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {!register && (
          <p>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        )}
        <p>
          {register ? 'Already have an account? ' : 'New to Lannent? '}
          <Link to={register ? '/login' : '/signup'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  );
}
