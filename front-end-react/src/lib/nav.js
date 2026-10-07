/**
 * Navigation that behaves like the original `window.location.href = ...`.
 *
 * Hrefs are resolved exactly as the browser resolved them on the static pages
 * (relative to the current URL), so a page can keep writing
 * `go('task-details.html?id=' + id)` or `go('../index.html')`. Every call is a
 * fresh "page load": PageHost remounts the page and re-runs Store.init(),
 * even when the target is the current URL.
 */
let _navigate = null;

export function setNavigator(fn) {
  _navigate = fn;
}

/** Resolves a page-relative href to "/path?query#hash" on this origin. */
export function resolveHref(href) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return url.href;
  return url.pathname + url.search + url.hash;
}

export function isInternal(href) {
  if (!href || href.startsWith('#')) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Stored files and the API are not app pages.
  return !url.pathname.startsWith('/api');
}

export function go(href, options = {}) {
  if (!isInternal(href) || !_navigate) {
    window.location.href = href;
    return;
  }
  _navigate(resolveHref(href), { replace: !!options.replace });
}

/** `location.reload()` equivalent: re-runs Store.init() and remounts the page. */
export function reload() {
  go(window.location.pathname + window.location.search + window.location.hash, { replace: true });
}
