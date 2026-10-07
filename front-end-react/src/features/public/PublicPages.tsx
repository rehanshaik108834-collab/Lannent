import { Link } from 'react-router-dom';
import styles from './PublicPages.module.css';

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link className="brand" to="/">
        Lannent.
      </Link>
      <nav aria-label="Main navigation">
        <Link to="/expert-landing">For experts</Link>
        <Link to="/login">Sign in</Link>
        <Link className="button" to="/signup">
          Get started
        </Link>
      </nav>
    </header>
  );
}
export function LandingPage({ expert = false }: { expert?: boolean }) {
  return (
    <>
      <PublicHeader />
      <main id="main" className={styles.main}>
        <section className={styles.hero}>
          <p className="eyebrow">
            {expert
              ? 'Independent expertise'
              : 'Work together. Build with confidence.'}
          </p>
          <h1>
            {expert ? (
              'Put your expertise to work.'
            ) : (
              <>
                Great work starts
                <br />
                with clear milestones.
              </>
            )}
          </h1>
          <p>
            {expert
              ? 'Help clients and workers assess deliverables through expert reviews and clear, actionable reports.'
              : 'Connect with skilled gig workers, organize your project into milestones, and keep feedback and deliverables in one place.'}
          </p>
          <div className={styles.actions}>
            <Link className="button" to={expert ? '/expert-signup' : '/signup'}>
              {expert ? 'Apply as an expert' : 'Start your next project'}
            </Link>
            <Link to={expert ? '/expert-login' : '/signup'}>
              {expert ? 'Expert sign in' : 'Find work →'}
            </Link>
          </div>
        </section>
        <section className={styles.cards} aria-label="How Lannent works">
          {[
            [
              '01',
              'Agree on the work',
              'Define the scope, choose a collaborator, and set clear milestones.',
            ],
            [
              '02',
              'Stay connected',
              'Keep project conversations, submissions, and feedback together.',
            ],
            [
              '03',
              'Review with confidence',
              'Review each milestone and request expert input when it is needed.',
            ],
          ].map(([step, title, text]) => (
            <article key={step}>
              <span className="eyebrow">{step}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className={styles.footer}>
        Lannent. · Projects built together.
      </footer>
    </>
  );
}
/** Password recovery requires an external email integration, which remains deferred. */
export function UnavailablePage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="status">
        <h1>Password recovery</h1>
        <p>
          Password reset emails are not available yet. This page cannot send a
          reset link or change your password.
        </p>
        <Link to="/login">Back to sign in</Link>
      </main>
    </>
  );
}
export function NotFoundPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="status">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link to="/">Go home</Link>
      </main>
    </>
  );
}
