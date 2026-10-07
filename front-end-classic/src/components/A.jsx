import { go, isInternal, resolveHref } from '../lib/nav';

/**
 * Drop-in for the original <a href="...">. Relative hrefs resolve as they did
 * on the static pages ("post-task.html", "../index.html", "task-details.html?id=t1").
 * Internal links navigate in-app (a fresh page: remount + Store.init); "#hash",
 * external and /api/files links stay plain anchors.
 */
export default function A({ href, onClick, children, ...rest }) {
  const internal = isInternal(href);
  return (
    <a
      href={internal ? resolveHref(href) : href}
      onClick={(e) => {
        onClick?.(e);
        if (!internal || e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
        e.preventDefault();
        go(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
