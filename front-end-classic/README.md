# front-end-classic

React (Vite, plain JSX) port of the original static UI in `../front-end/`. It keeps that UI's design, URLs and behaviour: every page renders the same markup, styles and text as its HTML original and is verified pixel-for-pixel against it.

## Run

The backend serves this app's build at http://localhost:3000 by default.

```bash
npm ci
npm run build                     # creates dist/, which the backend serves
cd ../back-end && npm run start:dev
```

For development with hot reload, keep the backend running on :3000 and start Vite, which proxies `/api` to it:

```bash
npm run dev                       # http://localhost:5180
```

`FRONTEND_UI` in the backend selects what is served at `/`: unset serves this app (or the original HTML pages if `dist/` is missing), `static` serves the original HTML pages in `../front-end/`, and `react` serves the redesigned `../front-end-react/` build.

## Layout

- `src/pages/<name>.jsx`: one component per original page `front-end/pages/<name>.html` (`index.jsx` is the landing page). Page-only CSS is in `src/pages/<name>.css` and is applied only while that page is mounted.
- `src/pages.js`: page titles and role guards.
- `src/App.jsx`: maps `/`, `/index.html` and `/pages/<name>.html` to pages. Each navigation is a fresh "page load": the page remounts and `Store.init()` reloads data, as the static pages did.
- `src/lib/`: `store.js` and `auth.js` (ported from `front-end/js/` with the same API), `validation.jsx` (validators, toasts, confirm dialogs, field errors), `nav.js` (`go`, `reload`), `hooks.js`.
- `src/components/`: `DashboardLayout` (sidebar and top bar), `Icon` (lucide 1.52.0, identical SVG output), `A` (links), `ExpertPicker`, toast/confirm hosts.
- `src/styles/styles.css`: `front-end/css/styles.css`, unchanged.

## Checking a page against the original

Run the backend with `FRONTEND_UI=static` so :3000 serves the original HTML, start `npm run dev`, then:

```bash
node scripts/compare.mjs <page> [--query id=t1] [--role worker] [--click "#btn"] [--fill "#input=text"]
node scripts/compare.mjs --all
```

It reports pixel differences, size and visible-text differences, and errors that only the React page logs. Images go to `compare-output/<page>/`. `CONVERSION.md` has the rules the pages were converted by.

Known comparison noise: `compliance-dashboard` logs an audit event on every load, so its counts differ between two captures; chart pages need `--wait 2500` for Chart.js animations to finish.
