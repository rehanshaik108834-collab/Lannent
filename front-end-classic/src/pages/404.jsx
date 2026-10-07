import A from '../components/A';
import { usePageStyle } from '../lib/hooks';
import css from './404.css?inline';

export default function NotFound() {
  usePageStyle(css);

  return (
    <div className="notfound">
      <div style={{ fontSize: 100, fontWeight: 900, letterSpacing: '-0.05em', background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16, lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>Page not found</h1>
      <p style={{ fontSize: 16, color: '#64748b', maxWidth: 400, lineHeight: 1.6, marginBottom: 40 }}>Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <A
          href="../index.html"
          style={{ padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontWeight: 600, textDecoration: 'none', transition: 'transform 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
        >
          Go Home
        </A>
        <button onClick={() => window.history.back()} style={{ padding: '12px 28px', borderRadius: 12, border: '1.5px solid rgba(99,102,241,0.3)', background: 'rgba(255,255,255,0.8)', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Go Back</button>
      </div>
    </div>
  );
}
