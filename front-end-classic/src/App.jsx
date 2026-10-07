import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PAGES } from './pages';
import { Store } from './lib/store';
import { Auth } from './lib/auth';
import { go, setNavigator } from './lib/nav';
import { ConfirmHost, ToastHost } from './components/Feedback';

// One lazy component per original page: src/pages/<name>.jsx.
const modules = import.meta.glob('./pages/*.jsx');
const components = {};
for (const [file, load] of Object.entries(modules)) {
  components[file.slice('./pages/'.length, -'.jsx'.length)] = lazy(load);
}

/** URL → original page name. "/" and "/index.html" are the landing page. */
function pageNameFor(pathname) {
  if (pathname === '/' || pathname === '/index.html') return 'index';
  const m = /^\/pages\/([a-z0-9-]+?)(?:\.html)?$/.exec(pathname);
  return m && PAGES[m[1]] ? m[1] : '404';
}

function Redirect({ to }) {
  useEffect(() => { go(to); }, [to]);
  return null;
}

/**
 * One "page load". Keyed per navigation, so every visit starts as the static
 * page did: fresh Store.init(), the page's own <title>, scrolled to the top,
 * the role guard applied before anything renders.
 */
function PageInstance({ name }) {
  const entry = PAGES[name];
  useState(() => {
    try { Store.init(); } catch (e) { console.error('[Store] init failed:', e); }
    return true;
  });

  useLayoutEffect(() => {
    document.title = entry.title;
    if (window.location.hash) {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target) { target.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [entry]);

  if (entry.roles) {
    const user = Auth.getCurrentUser();
    if (!user) return <Redirect to="/pages/login.html" />;
    if (!entry.roles.includes(user.role)) return <Redirect to={'/pages/' + Auth.getDashboardUrl(user.role)} />;
  }

  const Page = components[name];
  if (!Page) return null;
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  setNavigator(navigate);

  // A new page per navigation, except when only the #hash changed (in-page
  // anchor links), which never reloaded the static pages either.
  const prev = useRef({ sig: null, hash: null, pageKey: null });
  const sig = location.pathname + location.search;
  const pageKey = prev.current.sig === sig && prev.current.hash !== location.hash ? prev.current.pageKey : location.key;
  prev.current = { sig, hash: location.hash, pageKey };

  const name = pageNameFor(location.pathname);
  return (
    <>
      <PageInstance key={pageKey + name} name={name} />
      {/* Keyed per page load: leaving a page dropped its toast and dialog. */}
      <ToastHost key={'toast' + pageKey} />
      <ConfirmHost key={'confirm' + pageKey} />
    </>
  );
}
