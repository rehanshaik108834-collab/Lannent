# Converting an original HTML page to React

`front-end-classic/` is a React (Vite, plain JSX) port of the original static UI in `../front-end/`. The owner's requirement is that **UI and UX stay exactly the same**: same markup, classes, inline styles, text, icons, behaviour, redirects and data. The bar is a **0-pixel difference and identical visible text**, measured by `scripts/compare.mjs`.

Reference conversions (both verified at 0 pixels): `src/pages/worker-dashboard.jsx` (dashboard page) and `src/pages/login.jsx` (standalone page with a form). Read both before starting.

## Running things

Already running; do not start, stop or restart them:
- Backend + original pages: http://localhost:3000 (the originals are at `/pages/<name>.html` and `/index.html`)
- React dev server (Vite, hot reload): http://localhost:5180 (same URLs)

Compare a page (from `front-end-classic/`):

```
node scripts/compare.mjs <page> [<page> ...]
node scripts/compare.mjs task-details --query id=t1            # pages that need ?id=
node scripts/compare.mjs messages --role worker                # pages several roles can open
node scripts/compare.mjs post-task --click "#nextBtn" --fill "#title=Hello" --click ".tab-2"
```

It signs in as the page's role on both apps, captures full-page screenshots, and prints the pixel difference, sizes, the first visible-text difference, and errors that only the React page logs. Images and text dumps go to `compare-output/<page>/`; view `diff.png` (red pixels) with the Read tool when something differs. `--click`/`--fill` steps run on both apps before capture, so use them to compare modals, tabs, dropdowns, form errors and other interaction states as well as the initial render.

## Files you own

- `src/pages/<name>.jsx`: default export, one component per original page (`<name>` = the HTML filename). New files are picked up automatically; routing, `<title>` and the role guard come from `src/pages.js`.
- `src/pages/<name>.css`: the page's `<style>` blocks, verbatim, if any (see Styles).
- Page-private helpers can live in `src/pages/<name>/...` if a page is large.

**Do not edit** anything else: `src/components/`, `src/lib/`, `src/App.jsx`, `src/pages.js`, `src/main.jsx`, `src/styles/`, `scripts/`, `package.json`, `vite.config.js`, other agents' pages, and nothing outside `front-end-classic/`. Do not install packages. If the shared layer genuinely blocks you, work around it inside your page and report it in your final message.

## Shared layer

| Original | React |
| --- | --- |
| `Store.*` (store.js) | `import { Store } from '../lib/store'`: identical API, still synchronous. `Store.init()` already ran for this page load. |
| `Auth.*` (auth.js) | `import { Auth } from '../lib/auth'`: identical API; redirects go through the router. |
| `Validate.toast(msg, type, ms)`, `Validate.confirm(msg, ok, cancel)` | `import { Validate } from '../lib/validation'`: same signatures, rendered by React. `msg` can be a string or JSX. |
| `Validate.required/email/password/...` validators | `Validate.*`: unchanged. |
| `Validate.showError/clearError/form/attachAutoClears` | `const v = useFieldErrors()`: see login.jsx. `v.form(rules)`, `v.showError(id, msg)`, `v.clearError(id)`, `v.clearAllErrors()`, `style={{...base, ...v.fieldStyle(id)}}` on the field, `{v.error(id)}` placed **immediately after the field** (that is where the original inserted the `<p id="<id>_err">`). |
| `initDashboard({ role, activePath, pageTitle, pageSubtitle, content })` | `<DashboardLayout role activePath pageTitle pageSubtitle>{content}</DashboardLayout>` from `../components/DashboardLayout` |
| `renderEmptyState({...})` | `<EmptyState .../>` (same props) from `../components/DashboardLayout` |
| `<i data-lucide="name" style=".." class=".." id="..">` | `<Icon name="name" style={{..}} className=".." id=".." />` from `../components/Icon` (same lucide version, identical SVG) |
| `<a href="page.html?x=1">` | `<A href="page.html?x=1">` from `../components/A`: relative hrefs resolve exactly as before. Keep plain `<a>` for `#hash`, external and `/api/files` links. |
| `window.location.href = 'x.html'` | `go('x.html')` from `../lib/nav` (same relative resolution; always a fresh page load, even for the current URL) |
| `location.reload()` | `reload()` from `../lib/nav` |
| `new URLSearchParams(location.search).get('id')` | `getParam('id')` from `../lib/hooks` |
| Rebuilding `innerHTML` after a Store write | Read Store during render; after the write call `rerender()` from `const rerender = useRerender()` (`../lib/hooks`), or keep real UI state in `useState`. |
| Page `<style>` | `import css from './<name>.css?inline'; usePageStyle(css);` (`../lib/hooks`) |
| `ExpertPicker` (expert-picker.js) | `<ExpertPicker category selectedId onChange />` from `../components/ExpertPicker`, rendered **inside** the page's own container div |
| main.js `initScrollReveal` / smooth `#anchor` scroll | `useScrollReveal()`, `smoothScrollTo(e, '#id')` from `../lib/hooks` |
| `escapeHtml(x)` / `safeHref(x)` | Not needed for text in JSX (React escapes). Keep the `safeHref` rule for user-supplied URLs: `/^https?:\/\//i.test(url) ? url : ''`. |
| Chart.js (CDN 4.4.0) | `import Chart from 'chart.js/auto'` (4.4.0 installed); create in `useEffect` on a canvas ref and `destroy()` on cleanup. |

The role guard (`Auth.requireRole(...)` at the top of the original page) is **already enforced** before your component renders, using the roles in `src/pages.js`. Do not repeat it. Keep any other session or redirect logic the page had.

## Fidelity rules (these are where 0 pixels is won or lost)

1. **Same DOM.** Same elements, nesting, classes, ids, attributes and inline styles, in the same order. Convert `style="a:b"` to `style={{ a: 'b' }}` exactly; numbers become px, so keep units the original used, e.g. `'1.5'` vs `1.5` for line-height. Keep `title`, `placeholder`, `disabled`, `readonly` (as `readOnly`), etc.
2. **One text node where the original had one.** JSX splits `{n} pending review` into separate text nodes, and Chrome shapes text differently at node boundaries, which costs pixels. When an element's text mixes literal text and expressions, render it as one template string: `` {`${n} pending review`} ``, `` {`$${amount.toLocaleString()}`} ``, `` {`Client: ${name} · Due ${due}`} ``. Pure literal text or a lone `{expr}` is fine as is.
3. **Whitespace between inline elements.** HTML turns a newline plus indentation between inline elements or text into one space; JSX deletes it. Where the original shows a space between inline siblings (e.g. `<strong>A</strong>\n  text`, `</svg>\n Google` in a non-flex parent), add `{' '}` or keep the space inside a string. In flex or grid containers it doesn't matter.
4. **Same data and logic.** Port each page's script logic faithfully: same Store calls, same order, same fallbacks, same messages, same number and date formatting (`toLocaleString`, `toLocaleDateString(...)` options). Don't "fix" or improve behaviour, copy or wording. If the original has a bug that is visible to users, keep it, and mention it in your report.
5. **Interaction parity.** Every handler (`onclick`, `addEventListener`, `onmouseenter` hover styles, keyboard handlers, modals, tabs, filters, accordions, toggles, timers, file uploads, downloads) must behave the same way. Hover effects done by inline JS can stay imperative: `onMouseEnter={e => { e.currentTarget.style.background = '#f8f9fb'; }}`. Use state (not `display` mutation) for what is shown or hidden, but render the same `style.display` values the original set. Clean up listeners and timers in effects.
6. **Never retype long literals.** SVG paths, data URIs, long lists, long copy, seed-like arrays: copy them out of the original file with a small script (e.g. Python reading `../front-end/pages/<name>.html`) rather than typing them, and verify they are equal. One typo in an SVG path is a pixel diff that is hard to find.
7. **Text the original rendered as HTML.** Where the original interpolated a value **without** `escapeHtml` and that value contains markup on purpose (e.g. a static string with `<strong>`), render the equivalent JSX. User-supplied data stays plain text.
8. Inline `<script>` timing doesn't matter, but **order of effects** does where the original measured layout or focused elements after rendering: use `useEffect`/`useLayoutEffect`.
9. No `dangerouslySetInnerHTML` for page markup. The point is a real React conversion; it is acceptable only for third-party HTML the original injected verbatim, and you must report it if used.

## Styles

Copy every `<style>` block of the page (including ones inside JS template strings) into `src/pages/<name>.css` **verbatim and in document order**, and load it with `usePageStyle`. It is added after `styles.css` while the page is mounted and removed when it unmounts, exactly like a separate HTML document. Don't merge it into `styles.css` or another page's CSS.

## Testing and shared data

- Iterate until `compare.mjs` reports `✓` (0 pixels, same text, same size) for each page's initial state, and compare key interaction states with `--click`/`--fill` (open each modal or dropdown, switch each tab, trigger validation errors).
- Pages that need an id: find real ids with `curl -s localhost:3000/api/tasks -H "Authorization: Bearer <token>"`. Tokens are cached in `compare-output/.sessions.json` after your first compare run. Seed accounts are listed on the login page.
- Exercise mutating flows (submit, approve, hire, pay) functionally on the React page and check the result matches what the original does. The backend is shared with other agents and its data is in memory: prefer flows that create new records over ones that consume shared seed records, never call `/api/seed/reset`, and don't restart anything.
- Remaining diffs you cannot eliminate (e.g. a timestamp that changes between captures, random content in the original) are acceptable only if you explain them.

## Style of code

Plain JS + JSX, 2-space indentation, single quotes, function components and hooks, same naming as the reference pages. Keep the original's useful comments, adapted. No TypeScript, no new dependencies, no `React.StrictMode`.

## Report back

For each page: the final `compare.mjs` result lines (initial state + interaction states you checked), the flows you exercised, any remaining differences and why, any original bugs you preserved, and any shared-layer change you needed.
