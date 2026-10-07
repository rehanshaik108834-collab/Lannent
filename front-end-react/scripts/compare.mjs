/**
 * Compares a converted React page with the original HTML page, pixel for pixel.
 *
 *   node scripts/compare.mjs worker-dashboard login
 *   node scripts/compare.mjs task-details --query id=t1 --role worker
 *   node scripts/compare.mjs --all
 *
 * Options:
 *   --query a=b&c=d   query string for both URLs
 *   --role <role>     sign in as this role (default: the page's first allowed role;
 *                     pages without a guard are captured signed out)
 *   --width/--height  viewport (default 1280x800)
 *   --viewport        capture only the viewport instead of the full page
 *   --orig/--react    base URLs (default http://localhost:3000, http://localhost:5180)
 *   --click <css>     click this element before capturing (repeatable, runs in order)
 *   --fill <css>=<v>  fill this input before capturing (repeatable, in order with clicks)
 *   --wait <ms>       extra wait before capturing (default 700)
 *
 * Writes compare-output/<page>/{original,react,diff}.png and prints, per page:
 * pixel mismatch, size, whether visible text matches, and console errors.
 */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PAGES } = await import(path.join(root, 'src/pages.js'));

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);
const valued = new Set(['query', 'role', 'width', 'height', 'orig', 'react', 'click', 'fill', 'wait']);
const names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { if (valued.has(args[i].slice(2))) i++; continue; }
  names.push(args[i].replace(/\.html$/, ''));
}
const pages = flag('all') ? Object.keys(PAGES) : names;
if (!pages.length) {
  console.error('usage: node scripts/compare.mjs <page> [...] [--query ..] [--role ..] | --all');
  process.exit(1);
}

const ORIG = opt('orig', 'http://localhost:3000');
const REACT = opt('react', 'http://localhost:5180');
const width = Number(opt('width', 1280));
const height = Number(opt('height', 800));
const query = opt('query', '');
const roleOverride = opt('role', null);
const outDir = path.join(root, 'compare-output');
const steps = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--click') steps.push({ click: args[++i] });
  else if (args[i] === '--fill') { const v = args[++i]; const k = v.indexOf('='); steps.push({ fill: v.slice(0, k), value: v.slice(k + 1) }); }
}
const settle = Number(opt('wait', 700));

const CREDS = {
  client: ['client@gmail.com', 'Password@123'],
  worker: ['worker@gmail.com', 'Password@123'],
  expert: ['expert@gmail.com', 'Password@123'],
  superuser: ['super@gmail.com', 'Superadmin@123'],
  'revenue-admin': ['admin@gmail.com', 'Admin@123'],
  'intake-admin': ['intake@gmail.com', 'Intake@123'],
  'compliance-admin': ['compliance@gmail.com', 'Compliance@123'],
};

// Logins are cached on disk (tokens last 12h) so repeated runs do not hit
// the login rate limit.
const sessionFile = path.join(outDir, '.sessions.json');
let sessions = {};
try { sessions = JSON.parse(fs.readFileSync(sessionFile, 'utf8')); } catch (e) { sessions = {}; }
async function sessionFor(role) {
  if (sessions[role]) {
    const ok = await fetch(ORIG + '/api/auth/me', { headers: { Authorization: 'Bearer ' + sessions[role].token } }).then((r) => r.ok).catch(() => false);
    if (ok) return sessions[role];
  }
  const [email, password] = CREDS[role];
  const res = await fetch(ORIG + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  const data = json.data || json;
  if (!data.token) throw new Error(`login failed for ${role}: ${JSON.stringify(json).slice(0, 200)}`);
  sessions[role] = { session: data.session, token: data.token };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(sessionFile, JSON.stringify(sessions));
  return sessions[role];
}

const HIDE_MOVING = `
  *, *::before, *::after { caret-color: transparent !important; }
  video { visibility: hidden !important; }
`;

async function capture(browser, base, page, role) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (role) {
    const s = await sessionFor(role);
    await context.addInitScript(([session, token]) => {
      try {
        localStorage.setItem('lannent_session', JSON.stringify(session));
        localStorage.setItem('lannent_token', token);
      } catch (e) { /* about:blank */ }
    }, [s.session, s.token]);
  }
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  tab.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  tab.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, '')}`);
  });
  const url = `${base}/${page === 'index' ? 'index.html' : 'pages/' + page + '.html'}${query ? '?' + query : ''}`;
  await tab.goto(url, { waitUntil: 'networkidle' });
  await tab.addStyleTag({ content: HIDE_MOVING });
  for (const step of steps) {
    if (step.click) await tab.click(step.click);
    else await tab.fill(step.fill, step.value);
    await tab.waitForTimeout(300);
  }
  await tab.waitForTimeout(settle);
  const finalUrl = tab.url().replace(base, '');
  const title = await tab.title();
  const text = await tab.evaluate(() => document.body.innerText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim());
  const png = await tab.screenshot({ fullPage: !flag('viewport'), animations: 'disabled' });
  await context.close();
  return { png, errors, finalUrl, title, text };
}

function diffImages(a, b) {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  const w = Math.max(A.width, B.width);
  const h = Math.max(A.height, B.height);
  const pad = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  const pa = pad(A);
  const pb = pad(B);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: 0.1 });
  return { n, total: w * h, diff: PNG.sync.write(diff), sizeA: `${A.width}x${A.height}`, sizeB: `${B.width}x${B.height}` };
}

function firstTextDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return `line ${i + 1}:\n      original: ${JSON.stringify(la[i] ?? '<end>')}\n      react:    ${JSON.stringify(lb[i] ?? '<end>')}`;
  }
  return '';
}

const browser = await chromium.launch();
let failures = 0;
for (const page of pages) {
  const entry = PAGES[page];
  if (!entry) { console.log(`✗ ${page}: not in src/pages.js`); failures++; continue; }
  const role = roleOverride || (entry.roles ? entry.roles[0] : null);
  try {
    const o = await capture(browser, ORIG, page, role);
    const r = await capture(browser, REACT, page, role);
    const d = diffImages(o.png, r.png);
    const dir = path.join(outDir, page);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'original.png'), o.png);
    fs.writeFileSync(path.join(dir, 'react.png'), r.png);
    fs.writeFileSync(path.join(dir, 'diff.png'), d.diff);
    fs.writeFileSync(path.join(dir, 'original.txt'), o.text);
    fs.writeFileSync(path.join(dir, 'react.txt'), r.text);

    const pct = ((d.n / d.total) * 100).toFixed(3);
    const textSame = o.text === r.text;
    const ok = d.n === 0 && textSame && d.sizeA === d.sizeB;
    if (!ok) failures++;
    console.log(`${ok ? '✓' : '✗'} ${page}${query ? '?' + query : ''} [${role || 'signed out'}]  pixels differ: ${d.n} (${pct}%)  size: ${d.sizeA} vs ${d.sizeB}  text: ${textSame ? 'same' : 'DIFFERENT'}`);
    if (o.finalUrl !== r.finalUrl) console.log(`    url: original ended at ${o.finalUrl}, react at ${r.finalUrl}`);
    if (o.title !== r.title) console.log(`    title: ${JSON.stringify(o.title)} vs ${JSON.stringify(r.title)}`);
    if (!textSame) console.log('    first text difference ' + firstTextDifference(o.text, r.text));
    const newErrors = r.errors.filter((e) => !o.errors.includes(e));
    if (newErrors.length) console.log('    react-only errors:\n      ' + newErrors.join('\n      '));
    if (!ok) console.log(`    images: ${path.relative(process.cwd(), dir)}/{original,react,diff}.png`);
  } catch (e) {
    failures++;
    console.log(`✗ ${page}: ${e.message}`);
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
