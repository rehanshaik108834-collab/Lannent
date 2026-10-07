import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PAGES } from './pages';
import { Store } from './lib/store';
import { Auth } from './lib/auth';
import { go, setNavigator } from './lib/nav';
import { ConfirmHost, ToastHost } from './components/Feedback';

// One code-split component per original page: src/pages/<name>.jsx.
//
// A page whose code is not loaded yet suspends, and React holds a suspended
// screen for at least ~300ms: every first visit flashed blank. So after the
// first page renders, every page's code is fetched in the background, and a
// page that is already loaded renders directly instead of through lazy().
const modules = import.meta.glob('./pages/*.jsx');
const loaded = {};
const lazyComponents = {};
const loaders = {};
for (const [file, load] of Object.entries(modules)) {
  const name = file.slice('./pages/'.length, -'.jsx'.length);
  loaders[name] = () => load().then((m) => { loaded[name] = m.default; return m; });
  lazyComponents[name] = lazy(loaders[name]);
}

let preloadStarted = false;
function preloadAllPages() {
  if (preloadStarted) return;
  preloadStarted = true;
  const run = () => {
    for (const name of Object.keys(loaders)) {
      if (!loaded[name]) loaders[name]().catch(() => { /* lazy() retries on visit */ });
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 200);
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

  const Page = loaded[name] || lazyComponents[name];
  if (!Page) return null;
  return (
    <Suspense fallback={null}>
      <Page />
      <PreloadPages />
    </Suspense>
  );
}

/** Mounts once the first page has rendered, then fetches the other pages' code. */
function PreloadPages() {
  useEffect(() => { preloadAllPages(); }, []);
  return null;
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
