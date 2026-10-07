import { useEffect, useLayoutEffect, useReducer, useState } from 'react';

/**
 * Page-level <style> blocks. Each original page had its own document, so its
 * <style> applied only there. This adds the page's CSS after styles.css while
 * the page is mounted and removes it on leaving, so pages never leak styles
 * into each other.
 *
 *   import css from './post-task.css?inline';
 *   usePageStyle(css);
 */
export function usePageStyle(css) {
  useLayoutEffect(() => {
    if (!css) return undefined;
    const el = document.createElement('style');
    el.setAttribute('data-page-style', '');
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, [css]);
}

/** main.js initScrollReveal: .reveal elements get .visible when scrolled into view. */
export function useScrollReveal(deps = []) {
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal:not(.visible)');
    if (!reveals.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** main.js initSmoothScroll: in-page "#id" links scroll smoothly with a 90px offset. */
export function smoothScrollTo(e, hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  e.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: 'smooth' });
}

/** The current URL's query parameter, like new URLSearchParams(location.search).get(name). */
export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * The original pages re-rendered by rebuilding innerHTML after a Store write.
 * Here, read Store during render and call rerender() after the write.
 *
 *   const rerender = useRerender();
 *   Store.updateTask(id, patch); rerender();
 */
export function useRerender() {
  const [, bump] = useReducer((n) => n + 1, 0);
  return bump;
}

/**
 * The original pages called lucide.createIcons() after re-rendering part of
 * the page, and that call replaces EVERY [data-lucide] element in the
 * document (sidebar and top nav included) with a fresh SVG. Chrome then
 * repaints those areas, which shifts the anti-aliasing of the neighbouring
 * gradient boxes (logo, avatar) by a pixel or two.
 *
 * refreshIcons() reproduces that repaint: after the next commit, before the
 * browser paints, every lucide SVG is detached and re-inserted in place. The
 * nodes are the same objects, so React's references stay valid.
 *
 *   const refreshIcons = useLucideRefresh();
 *   onClick={() => { setTab('x'); refreshIcons(); }}
 */
export function useLucideRefresh() {
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    if (!tick) return;
    document.querySelectorAll('svg[data-lucide]').forEach((s) => {
      const parent = s.parentNode;
      if (!parent) return;
      const next = s.nextSibling;
      parent.removeChild(s);
      parent.insertBefore(s, next);
    });
  }, [tick]);
  return () => setTick((t) => t + 1);
}
