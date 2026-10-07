import { createElement } from 'react';
import { icons } from 'lucide';

/*
 * Renders exactly what lucide.createIcons() produced from
 * <i data-lucide="name" ...attrs> in the original pages: same lucide version
 * (1.52.0), same default attributes, same class list, same aria-hidden rule.
 * An unknown name stays an empty <i>, as it did there (e.g. github, linkedin).
 */

const toCamelCase = (s) =>
  s.replace(/^([A-Z])|[\s-_]+(\w)/g, (m, p1, p2) => (p2 ? p2.toUpperCase() : p1.toLowerCase()));
const toPascalCase = (s) => {
  const c = toCamelCase(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
const reactKey = (k) =>
  k.startsWith('data-') || k.startsWith('aria-') ? k : k.replace(/-([a-z])/g, (m, c) => c.toUpperCase());

function child([tag, attrs, children], i) {
  const props = { key: i };
  for (const k of Object.keys(attrs || {})) props[reactKey(k)] = attrs[k];
  return createElement(tag, props, children?.length ? children.map(child) : undefined);
}

export default function Icon({ name, className, ...rest }) {
  const node = icons[toPascalCase(name)];
  if (!node) return <i data-lucide={name} className={className} {...rest} />;
  const a11y = Object.keys(rest).some((p) => p.startsWith('aria-') || p === 'role' || p === 'title');
  const classes = ['lucide', `lucide-${name}`, ...(className ? className.split(' ') : [])]
    .filter((c, i, arr) => c && c.trim() !== '' && arr.indexOf(c) === i)
    .join(' ');
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-lucide={name}
      {...(a11y ? {} : { 'aria-hidden': 'true' })}
      {...rest}
      className={classes}
    >
      {node.map(child)}
    </svg>
  );
}
