#!/usr/bin/env node
// Pill → Figma: assemble deck.json (slides + Design pages + FigJam board) and deck.html from the repo.
// Node 22+, no npm deps. Images go through macOS `sips` (webp/png → jpeg, downscaled), cached in figma/assets/.
// Usage: node figma/build-deck.mjs            (writes deck.json, deck.html, metrics.json)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { measurePlugin } from './measure-plugin.mjs';

const T0 = performance.now();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ASSETS = path.join(HERE, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });
const rel = (p) => path.relative(ROOT, p);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ───────────────────────────── palette / type ─────────────────────────────
const C = {
  paper: '#F7F8F7', surface: '#FFFFFF', ink: '#16181B', ink2: '#4A4E55', muted: '#7C8188',
  line: 'rgba(22,24,27,0.10)', line2: 'rgba(22,24,27,0.18)',
  sky: '#4FB3FF', skyInk: '#2A8FE0', skyTint: 'rgba(79,179,255,0.14)',
  mint: '#5FD39A', mintInk: '#2FA874', mintTint: 'rgba(95,211,154,0.16)',
  amber: '#E09A3A', amberInk: '#B87420', amberTint: 'rgba(224,154,58,0.16)',
  grey: '#9AA0A6', greyTint: 'rgba(154,160,166,0.18)',
  violet: '#7A5CFF', violetInk: '#5B3FE0', violetTint: 'rgba(122,92,255,0.10)',
  dark: '#0E1216', darkText: '#E9EEF2',
};
const FONTS = {
  sans: ['Inter'],
  serif: ['Instrument Serif', 'Playfair Display', 'Georgia', 'Times New Roman', 'Inter'],
  mono: ['JetBrains Mono', 'Roboto Mono', 'IBM Plex Mono', 'Inter'],
};

// ───────────────────────────── images ─────────────────────────────
// ffmpeg (if on PATH) downscales, crops very tall full-page shots to their first screens, and writes JPEG.
// Without ffmpeg, macOS sips downscales only (no crop; deck.json gets bigger).
const IMAGES = {}; // id -> { w, h, mime, file, b64, cropped }
let converted = 0;
const HAS_FFMPEG = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const PHONE = { w: 390, cap: 2.2, q: 9 };      // gallery + slide phones: 390 wide, at most 390×858
const DESK = { w: 720, cap: 0.75, q: 9 };      // gallery desktops: 720 wide, at most 720×540
const BIG = (w) => ({ w, cap: 0, q: 5 });      // slide hero images, uncropped
const srcDims = new Map();
function dimsOf(files) {
  const need = files.filter((f) => !srcDims.has(f));
  for (let i = 0; i < need.length; i += 80) {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', ...need.slice(i, i + 80)], { encoding: 'utf8' });
    let cur = null;
    for (const line of out.split('\n')) {
      const m = line.match(/^\s+pixel(Width|Height):\s*(\d+)/);
      if (!m && line.trim()) { cur = line.trim(); srcDims.set(cur, {}); continue; }
      if (m && cur) srcDims.get(cur)[m[1] === 'Width' ? 'w' : 'h'] = +m[2];
    }
  }
  return files.map((f) => srcDims.get(f));
}
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no SOF');
}
/** Register a screenshot; returns its image id. spec = { w: max width, cap: max height/width (0 = none), q: ffmpeg -q:v }. */
function img(src, spec = PHONE) {
  const abs = path.isAbsolute(src) ? src : path.join(ROOT, src);
  const id = rel(abs).replace(/^pill\/web\/dev-shots\//, 'app/').replace(/^pill-site\/dev-shots\//, 'site/').replace(/\.[a-z]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-') + '-' + spec.w + (spec.cap ? 'c' : '');
  if (IMAGES[id]) return id;
  const out = path.join(ASSETS, id + '.jpg');
  const [d] = dimsOf([abs]);
  const cropped = HAS_FFMPEG && spec.cap > 0 && d.h / d.w > spec.cap + 0.02;
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(abs).mtimeMs) {
    if (HAS_FFMPEG) {
      const crop = spec.cap ? `crop=iw:'min(ih,trunc(iw*${spec.cap}))':0:0,` : '';
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', abs, '-vf', `${crop}scale='min(${spec.w},iw)':-2`, '-q:v', String(spec.q), out]);
    } else {
      const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55'];
      if (d.w > spec.w) args.push('--resampleWidth', String(spec.w));
      execFileSync('sips', [...args, abs, '--out', out], { stdio: 'ignore' });
    }
    converted++;
  }
  const buf = fs.readFileSync(out);
  const { w, h } = jpegSize(buf);
  IMAGES[id] = { w, h, mime: 'image/jpeg', file: rel(out), src: rel(abs), b64: buf.toString('base64'), cropped, srcW: d.w, srcH: d.h };
  return id;
}
const listShots = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(webp|png|jpe?g)$/i.test(e.name)) out.push(p);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
};

// ───────────────────────────── repo facts ─────────────────────────────
function cssVars(css) {
  const vars = [];
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const m of block[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars.push({ name: m[1], value: m[2].trim() });
  }
  return vars;
}
const siteVars = cssVars(read('pill-site/src/styles.css'));
const appVars = cssVars(read('pill/web/src/index.css'));
const norm = (v) => v.replace(/\s+/g, '').toLowerCase();
const appByName = new Map(appVars.map((v) => [v.name, v.value]));
const drift = { identical: 0, changed: [], missing: [] };
for (const v of siteVars) {
  if (!appByName.has(v.name)) drift.missing.push(v.name);
  else if (norm(appByName.get(v.name)) === norm(v.value)) drift.identical++;
  else drift.changed.push(`${v.name}: ${v.value} → ${appByName.get(v.name)}`);
}
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 }; }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
const appValue = (name, seen = new Set()) => {
  const v = appByName.get(name);
  const ref = v && v.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (ref && !seen.has(ref[1])) return appValue(ref[1], seen.add(name));
  return v;
};
const tokens = [];
for (const v of appVars) {
  if (tokens.some((t) => t.name === v.name)) continue;
  const value = appValue(v.name);
  const rgba = value && parseColor(value);
  const num = value && value.match(/^(-?[\d.]+)px$/);
  if (rgba) tokens.push({ name: v.name, css: `--${v.name}`, value: v.value, kind: 'color', rgba, alias: v.value.startsWith('var(') ? v.value.slice(6, -1) : null });
  else if (num) tokens.push({ name: v.name, css: `--${v.name}`, value: v.value, kind: 'number', number: +num[1] });
  else tokens.push({ name: v.name, css: `--${v.name}`, value: v.value, kind: 'text' });
}
const tokenColors = tokens.filter((t) => t.kind === 'color');
const tokenNumbers = tokens.filter((t) => t.kind === 'number');

// git timeline (figma/git-timeline.txt is a snapshot; fall back to live git)
const timeline = fs.readFileSync(path.join(HERE, 'git-timeline.txt'), 'utf8').trim().split('\n');

// persona panels
const finalDebate = JSON.parse(read('final-debate-2026-10-23.json')).final;
const PERSONA = {
  clinic_pharmacist_kenya: 'Kenyan clinic pharmacist', who_sf_medicines_officer: 'WHO medicines officer', patient_bill_advocate: 'Patient bill advocate',
  sf_traffic_signal_engineer: 'Traffic signal engineer', vision_zero_advocate: 'Vision Zero advocate', rideshare_driver: 'Rideshare driver',
  hyphenate_judge: 'Hyphenate judge', hardware_judge: 'Hardware judge', anthropic_judge: 'Anthropic judge', people_first_judge: 'People-First judge',
  bright_data_judge: 'Bright Data judge', spacetimedb_judge: 'SpacetimeDB judge', healthtech_vc: 'Health-tech VC', mobility_vc: 'Mobility VC',
  cs_teammate: 'CS teammate', ethicist_privacy: 'Ethicist',
};
const finalVotes = Object.entries(finalDebate).filter(([, v]) => v && v.final_pick).map(([k, v]) => ({
  who: PERSONA[k] || k.replace(/_/g, ' '), pick: v.final_pick, why: String(v.why_in_one_sentence || '').replace(/\s+/g, ' '),
  lot: v.per_idea?.LOT, bill: v.per_idea?.BILL, streets: v.per_idea?.STREETS,
}));
const siteDebate = read('website-debate-2026-10-24.md').split('\n')
  .map((l) => l.match(/^\| ([^|*][^|]*?) \| (\d+) \| (\d+) \| ([a-e]) \|$/)).filter(Boolean)
  .map((m) => ({ who: m[1], story: +m[2], plain: +m[3], opening: m[4] }));
// stage log (STAGE-LOG.md is the source of truth; the deck and the Design page read it)
const stageMd = fs.readFileSync(path.join(HERE, 'STAGE-LOG.md'), 'utf8');
const stages = [...stageMd.matchAll(/^## Stage (\d) · ([^\n]+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)].map((m) => {
  const body = m[3];
  const field = (label) => {
    const f = body.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=^\\*\\*[A-Z][^*]*:\\*\\*|^---|$(?![\\s\\S]))`, 'm'));
    return f ? f[1].replace(/`/g, '').replace(/\s+/g, ' ').trim() : '';
  };
  const words = body.replace(/[*`#>|-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { n: +m[1], name: m[2].trim(), tools: field('Tools'), minutes: field('Minutes'), rating: field('Rating'), did: field('What we did'), broke: field('What broke'), forward: field('Into the project'), words };
});
if (stages.length !== 4) throw new Error(`STAGE-LOG.md: expected 4 "## Stage N · Name" sections, found ${stages.length}`);

// ───────────────────────────── screenshots ─────────────────────────────
const ROUTES = [
  [/welcome|onboard/, '/welcome'], [/kiosk/, '/kiosk'], [/story/, '/story'], [/settings/, '/settings'],
  [/sharecard|eval|verdict|needslab|unable|pass/, '/evaluation/:id'], [/run-|run$|runeval-run|spinpill|pillmotion-run/, '/run/:id'],
  [/runs/, '/runs'], [/deliveries/, '/deliveries'], [/delivery/, '/delivery/:id'], [/bottle|label|scan/, '/bottle'],
  [/place/, '/place'], [/medicines/, '/medicines'], [/calibration/, '/calibration'], [/verify/, '/verify'], [/ask/, '/ask'],
  [/schedule/, '/schedule'], [/activity/, '/activity'], [/log/, '/log'], [/dashboard|today/, '/'], [/home|readaloud/, '/home'],
];
const routeFor = (name) => (ROUTES.find(([re]) => re.test(name)) || [null, '/'])[1];
const SCREEN_FILE = {
  '/welcome': 'Onboarding.tsx', '/kiosk': 'Kiosk.tsx', '/story': 'Story.tsx', '/settings': 'Settings.tsx', '/evaluation/:id': 'Evaluation.tsx',
  '/run/:id': 'Run.tsx', '/runs': 'Runs.tsx', '/deliveries': 'Deliveries.tsx', '/delivery/:id': 'Delivery.tsx', '/bottle': 'Bottle.tsx',
  '/place': 'Place.tsx', '/medicines': 'Medicines.tsx', '/calibration': 'Calibration.tsx', '/verify': 'Verify.tsx', '/ask': 'Ask.tsx',
  '/schedule': 'Schedule.tsx', '/activity': 'Activity.tsx', '/log': 'Log.tsx', '/': 'Dashboard.tsx', '/home': 'Home.tsx',
};
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Los_Angeles' });
const GROUP_NAME = {
  flowsa: 'App v1 · flow A', flowsb: 'App v1 · flow B', e2e: 'App v1 · end-to-end run', payreal: 'Payments (x402 / Nessie)', dashviz: 'App v2 · dashboards',
  motion: 'App v2 · motion', pillmotion: 'App v2 · pill fill motion', runeval: 'Run + evaluation pass', appbackend: 'Backend wiring (Claude, Gemini)',
  appstory: 'Story + settings', v2: 'App v2 · every route',
};
function screenGroups(dir, isSite) {
  const files = listShots(dir).filter((f) => !/peel|\/full\.webp$/.test(f));
  const dims = dimsOf(files);
  const groups = new Map();
  files.forEach((f, i) => {
    const d = dims[i];
    if (!d?.w) return;
    const relDir = path.relative(path.join(ROOT, dir), path.dirname(f));
    const base = path.basename(f).replace(/\.[a-z]+$/i, '');
    const key = isSite ? (d.w <= 700 ? 'Phone' : 'Desktop') : (relDir || base.split('-')[0]);
    const phone = d.w <= 700;
    if (!groups.has(key)) groups.set(key, { key, items: [], t: Infinity });
    const g = groups.get(key);
    const t = fs.statSync(f).mtimeMs;
    g.t = Math.min(g.t, t);
    const name = (isSite ? 'Site · ' : 'App · ') + (relDir ? relDir + '/' : '') + base;
    const route = isSite ? null : routeFor(base);
    const id = img(f, phone ? PHONE : DESK);
    g.items.push({ name, label: (relDir ? relDir + '/' : '') + base, img: id, kind: phone ? 'phone' : 'desktop', route, source: route ? `pill/web/src/screens/${SCREEN_FILE[route]}` : null, cropped: IMAGES[id].cropped ? `${d.w}×${d.h}` : null, t });
  });
  return [...groups.values()].sort((a, b) => a.t - b.t).map((g) => ({
    title: isSite ? `Website · ${g.key.toLowerCase()} screenshots` : (GROUP_NAME[g.key] || g.key),
    sub: `${g.items.length} screenshot${g.items.length === 1 ? '' : 's'} · first taken ${hhmm(g.t)} PDT · ${isSite ? 'pill-site/dev-shots' : 'pill/web/dev-shots/' + (['e2e', 'v2'].includes(g.key) ? g.key : g.key + '-*')}`,
    items: g.items.sort((a, b) => (a.kind === b.kind ? a.t - b.t : a.kind === 'phone' ? -1 : 1)).map(({ t, ...it }) => it),
  }));
}
const appGroups = screenGroups('pill/web/dev-shots', false);
const siteGroups = screenGroups('pill-site/dev-shots', true);
const count = (gs, kind) => gs.reduce((n, g) => n + g.items.filter((i) => !kind || i.kind === kind).length, 0);
const appShotCount = count(appGroups), siteShotCount = count(siteGroups), appPhoneCount = count(appGroups, 'phone');

// ───────────────────────────── element helpers ─────────────────────────────
const W = 1920, H = 1080, X = 120;
const text = (x, y, w, t, o = {}) => ({ t: 'text', x, y, w, text: t, size: 30, font: 'sans', weight: 400, color: C.ink, lh: 140, ls: 0, align: 'left', ...o });
const eyebrow = (x, y, t, color = C.muted, w = 1200) => text(x, y, w, t.toUpperCase(), { font: 'mono', size: 22, weight: 500, ls: 14, color, lh: 120 });
const head = (x, y, w, t, size = 104, o = {}) => text(x, y, w, t, { font: 'serif', size, lh: 100, ls: -1.5, ...o });
const body = (x, y, w, t, o = {}) => text(x, y, w, t, { size: 30, color: C.ink2, lh: 145, ...o });
const rect = (x, y, w, h, o = {}) => ({ t: 'rect', x, y, w, h, fill: C.surface, radius: 0, ...o });
const card = (x, y, w, h, o = {}) => rect(x, y, w, h, { fill: C.surface, radius: 28, stroke: C.line, strokeW: 2, ...o });
const image = (x, y, w, h, id, o = {}) => ({ t: 'image', x, y, w, h, img: id, radius: 0, fit: 'top', ...o });
const capsule = (x, y, w, h, level, o = {}) => ({ t: 'capsule', x, y, w, h, level, fill: C.sky, track: C.surface, stroke: C.sky, strokeW: 4, ...o });
function chip(x, y, label, fg, bg, o = {}) {
  const size = o.size || 22;
  const w = o.w || Math.round(label.length * size * 0.66 + size * 2.2);
  const h = Math.round(size * 2);
  return [rect(x, y, w, h, { fill: bg, radius: h / 2, ...(o.stroke ? { stroke: o.stroke, strokeW: 2 } : {}) }),
    text(x, y + (h - size * 1.2) / 2, w, label, { font: o.font || 'mono', size, weight: 600, color: fg, align: 'center', lh: 120, ls: o.ls ?? 6 })];
}
/** Phone mock: rounded white bezel + screenshot cropped from the top. */
function phone(x, y, w, id, h = Math.round(w * 2.05)) {
  const pad = Math.round(w * 0.028);
  return [rect(x, y, w, h, { fill: C.surface, radius: Math.round(w * 0.13), stroke: C.line2, strokeW: 2, shadow: true }),
    image(x + pad, y + pad, w - 2 * pad, h - 2 * pad, id, { radius: Math.round(w * 0.11) })];
}
function browserShot(x, y, w, id, h) {
  const meta = IMAGES[id];
  const ih = h ?? Math.round((w * meta.h) / meta.w);
  return [rect(x, y, w, ih + 44, { fill: C.surface, radius: 22, stroke: C.line2, strokeW: 2, shadow: true }),
    ...[0, 1, 2].map((i) => ({ t: 'ellipse', x: x + 22 + i * 24, y: y + 15, w: 14, h: 14, fill: ['#FF6159', '#FFBD2E', '#28C941'][i] })),
    image(x + 2, y + 44, w - 4, ih - 2, id, { radius: 0, fit: 'top' })];
}
function logo(x, y, s = 1) {
  return [capsule(x, y, 64 * s, 28 * s, 0.5, { fill: C.mint, stroke: C.ink, strokeW: 2, track: C.surface }),
    text(x + 78 * s, y - 3 * s, 200, 'Pill', { font: 'serif', size: 34 * s, lh: 100 })];
}
function frameChrome(n, total, label) {
  return [...logo(X, 56, 0.8), text(X + 260, 56, 1000, label.toUpperCase(), { font: 'mono', size: 18, weight: 500, ls: 14, color: C.muted, lh: 130 }),
    text(W - X - 400, 56, 400, `${String(n).padStart(2, '0')} / ${total}`, { font: 'mono', size: 18, weight: 500, ls: 10, color: C.muted, align: 'right', lh: 130 }),
    rect(X, H - 70, W - 2 * X, 2, { fill: C.line }),
    text(X, H - 54, 1200, 'Pill · Cal Hacks 13.0 · pill-site.vercel.app', { font: 'mono', size: 18, color: C.muted, ls: 6, lh: 130 })];
}

// ───────────────────────────── slides ─────────────────────────────
const IM = {
  runMid: img('pill/web/dev-shots/pillmotion-run-mid-phone.webp'),
  pass: img('pill/web/dev-shots/runeval-eval-pass.webp'),
  needsLab: img('pill/web/dev-shots/pillmotion-eval-needslab-phone.webp'),
  unable: img('pill/web/dev-shots/pillmotion-eval-u1-phone.webp'),
  release: img('pill/web/dev-shots/payreal-delivery-release-live-phone.webp'),
  hold: img('pill/web/dev-shots/flowsb-delivery-hold.webp'),
  verify: img('pill/web/dev-shots/payreal-verify-real402-phone.webp'),
  siteCoinbase: img('pill-site/dev-shots/sitestory-coinbase.webp', BIG(720)),
  siteHero: img('pill-site/dev-shots/sitestory-hero.webp', BIG(1024)),
  station: img('pill-site/dev-shots/station2-60.png', BIG(1200)),
};
const gridPhones = ['v2/welcome-phone', 'e2e/03-bottle', 'v2/place-phone', 'pillmotion-run-mid-phone', 'runeval-eval-pass', 'e2e/10-delivery-policy', 'v2/medicines-phone', 'v2/calibration-phone']
  .map((n) => img(`pill/web/dev-shots/${n}.webp`));
const sitePhones = ['m-problem', 'm-verdicts', 'm-pay'].map((n) => img(`pill-site/dev-shots/${n}.webp`));

const slides = [];
const S = (name, els, notes, bg = C.paper) => slides.push({ id: `s${String(slides.length + 1).padStart(2, '0')}`, name, bg, els, notes });

// 1 · title
S('Title', [
  ...logo(X, 64, 1.1),
  eyebrow(X, 230, 'Cal Hacks 13.0 · Idea to Demo · Figma'),
  head(X, 290, 1100, [{ s: 'The box measures.\n' }, { s: 'Pill explains.', italic: true }], 150, { lh: 96 }),
  body(X, 640, 900, 'A $40 lab-in-a-box. Drop one tablet in water, close the lid, and three minutes later it says PASS, NEEDS LAB or UNABLE TO VERIFY. In a clinic, that answer decides whether the supplier gets paid.', { size: 32 }),
  ...chip(X, 900, 'PASS', C.mintInk, C.mintTint), ...chip(X + 150, 900, 'NEEDS LAB', C.amberInk, C.amberTint), ...chip(X + 380, 900, 'UNABLE TO VERIFY', '#5F656B', C.greyTint),
  capsule(1010, 150, 280, 780, 0.53, { fill: C.sky, stroke: C.sky, strokeW: 6 }),
  text(1010, 640, 280, '53%', { font: 'serif', size: 96, align: 'center', color: C.ink, lh: 100 }),
  ...phone(1430, 250, 360, IM.runMid),
], 'Open on the object. One tablet, about three minutes, one of three words. In clinic mode that word holds or releases a supplier\'s payment. Everything in this deck was generated from our repo by the Pill → Figma plugin.');

// 2 · problem
const stats = [
  ['1 in 10', 'medical products in low- and middle-income countries estimated substandard or falsified', 'WHO, 2017'],
  ['116,000', 'extra malaria deaths a year in sub-Saharan Africa, modelled, from substandard and falsified antimalarials (range 64,000–158,000)', 'LSHTM model, cited by WHO, 2017'],
  ['>300', "children's deaths linked to contaminated cough syrups in three countries, 2022–23, most under five", 'WHO, Jan 2023'],
  ['$30.5B', "spent each year on substandard and falsified medical products, by WHO's estimate", 'WHO fact sheet, 2024'],
];
S('The problem', [
  ...frameChrome(2, 16, 'The problem'),
  head(X, 170, 1000, 'One in ten.', 140),
  body(X, 345, 1500, 'The instrument that catches a bad tablet in a lab costs $20,000 to $100,000 and sits far from the clinics that need it.', { size: 32 }),
  ...stats.flatMap(([big, what, src], i) => {
    const x = X + i * 425, y = 520, w = 395;
    return [card(x, y, w, 420), rect(x + 32, y + 32, 56, 6, { fill: [C.sky, C.amber, C.amber, C.sky][i], radius: 3 }),
      text(x + 32, y + 62, w - 64, big, { font: 'serif', size: 88, lh: 100 }),
      text(x + 32, y + 176, w - 64, what, { size: 24, color: C.ink2, lh: 140 }),
      text(x + 32, y + 370, w - 64, src, { font: 'mono', size: 17, color: C.muted, lh: 130 })];
  }),
], 'Numbers exactly as on our site, each with its source. 116,000 is the central estimate of a modelled range, 64,000 to 158,000. We do not animate these.');

// 3 · idea + two channels
S('The idea', [
  ...frameChrome(3, 16, 'The idea'),
  head(X, 170, 900, 'Lot numbers can be copied. Dissolution cannot.', 92),
  body(X, 400, 820, 'A recall lookup trusts the label. Pill measures the tablet itself: one tablet in 900 mL of water, a paddle at the same speed every run, two light sensors watching it dissolve.', { size: 29 }),
  card(X, 640, 400, 300, { fill: C.skyTint, stroke: 'rgba(79,179,255,0.35)' }),
  eyebrow(X + 32, 672, 'Channel A · inline', C.skyInk, 340),
  text(X + 32, 716, 340, 'Blue light fades', { font: 'serif', size: 44, lh: 105 }),
  text(X + 32, 780, 340, 'A 465–475 nm LED shines across the cup. Riboflavin absorbs it as the tablet dissolves.', { size: 22, color: C.ink2, lh: 140 }),
  card(X + 420, 640, 400, 300, { fill: C.mintTint, stroke: 'rgba(95,211,154,0.45)' }),
  eyebrow(X + 452, 672, 'Channel B · 90°', C.mintInk, 340),
  text(X + 452, 716, 340, 'Green glow rises', { font: 'serif', size: 44, lh: 105 }),
  text(X + 452, 780, 340, 'A second sensor behind green plastic sees the riboflavin glow. Chalk clouds the water; it does not glow.', { size: 22, color: C.ink2, lh: 140 }),
  rect(1000, 170, 800, 770, { fill: '#0B0C0E', radius: 28 }),
  image(1000, 230, 800, 533, IM.station, { fit: 'cover', radius: 0 }),
  text(1040, 800, 720, 'Fig 1 · The station, drawn in code for the website: cup, blue LED, two sensors, thermistor, stepper paddle, ESP32, Pi touchscreen.', { font: 'mono', size: 19, color: '#8E9AA6', lh: 140 }),
], 'Why measurement beats lookup: the FDA found falsified product carrying a real lot number. Two channels: inline absorbance and 90° glow. The ESP32 measures; it decides nothing.');

// 4 · how a run works
const steps = [['Night before', 'Ten reference runs make the band.'], ['0:00', 'Photograph the bottle. Lot checked against the FDA recall list.'], ['0:20', 'Dark, then blank. Lid open? The run does not start.'], ['0:40', 'Drop one tablet. The paddle turns. The pill fills.'], ['3:00', 'The curve flattens. Seven rules, in order. The rule that fired is printed.']];
S('How a run works', [
  ...frameChrome(4, 16, 'How a run works'),
  head(X, 160, 1500, 'Three minutes, start to verdict.', 96),
  ...steps.flatMap(([t, d], i) => {
    const y = 330 + i * 120;
    return [{ t: 'ellipse', x: X, y: y + 6, w: 26, h: 26, fill: i === 3 ? C.sky : C.surface, stroke: C.sky, strokeW: 4 },
      ...(i < steps.length - 1 ? [rect(X + 11, y + 40, 4, 84, { fill: C.skyTint })] : []),
      text(X + 50, y, 200, t, { font: 'mono', size: 23, weight: 500, color: C.skyInk, lh: 130 }),
      text(X + 250, y - 2, 560, d, { size: 26, color: C.ink, lh: 135 })];
  }),
  text(1040, 320, 760, 'The pill fill: how far this tablet has dissolved, as a % of the reference plateau.', { size: 24, color: C.ink2, lh: 140 }),
  ...[[0, 'blank'], [0.22, 'dissolving'], [0.53, 'dissolving'], [0.86, 'settling'], [1, 'plateau']].flatMap(([lvl, word], i) => {
    const x = 1060 + i * 150;
    return [capsule(x, 420, 96, 360, lvl, { fill: lvl === 1 ? C.mint : C.sky, stroke: lvl === 1 ? C.mint : C.sky, strokeW: 4 }),
      text(x - 27, 800, 150, `${Math.round(lvl * 100)}%`, { font: 'serif', size: 52, align: 'center', lh: 100 }),
      text(x - 27, 866, 150, word, { font: 'mono', size: 17, color: C.muted, align: 'center', lh: 130 })];
  }),
  text(1040, 925, 760, 'Levels shown are an illustration; the app draws them live from the sensor stream.', { size: 19, color: C.muted, lh: 140 }),
], 'The app shows the run as a pill filling to the reference plateau. At 100% the curve has flattened and the seven rules run. The verdict comes from deterministic rules, not from a model.');

// 5 · three answers
const verdicts = [
  ['PASS', C.mintInk, C.mintTint, IM.pass, 'Plateau in the reference band and the glow rose with it (P1).'],
  ['NEEDS LAB', C.amberInk, C.amberTint, IM.needsLab, 'Light dropped with no glow, no plateau, or a plateau outside the band (N1–N3).'],
  ['UNABLE TO VERIFY', '#5F656B', C.greyTint, IM.unable, 'No reference for this drug, a fault, or too little data (U1–U3).'],
];
S('Three answers', [
  ...frameChrome(5, 16, 'Three answers'),
  head(X, 160, 1300, [{ s: 'Three answers. ' }, { s: 'Never a guess.', italic: true }], 96),
  ...verdicts.flatMap(([word, fg, bg, id, why], i) => {
    const x = X + i * 570;
    return [...chip(x, 300, word, fg, bg, { size: 24 }),
      text(x, 370, 500, why, { size: 23, color: C.ink2, lh: 140 }),
      ...phone(x + 30, 460, 290, id, 530)];
  }),
  text(X + 1440, 460, 240, 'Seven rules, checked in order. A model writes the plain-English "why"; it never sets the verdict.', { size: 22, color: C.ink2, lh: 145 }),
], 'Three words only. PASS means this tablet\'s curve matched last night\'s riboflavin references on this box. It does not mean right drug, right dose or contaminant-free.');

// 6 · clinic mode
const clauses = [['P1', 'A release needs PASS, no recall record for the lot, amount within the spend cap, and the pharmacist\u2019s tap.'], ['P2', 'NEEDS LAB: hold, and draft the lab referral with the curve attached.'], ['P3', 'UNABLE TO VERIFY: escalate to a person; no money moves.'], ['P4', 'A recall hit holds the payment regardless of the verdict.'], ['P5', 'Amount above the cap: escalate.'], ['P6', 'Recall lookup unreachable: hold until a lookup succeeds or a human overrides.']];
S('Clinic mode', [
  ...frameChrome(6, 16, 'Clinic mode · the payment gate'),
  head(X, 160, 900, 'The verdict holds the payment.', 84),
  ...chip(X, 290, 'SANDBOX MONEY', C.ink, C.amberTint),
  body(X, 360, 900, 'A clinic samples one tablet from each delivery. The policy agent reads the verdict, the recall check and the spend cap, and proposes release, hold or escalate. A pharmacist taps.', { size: 27 }),
  ...clauses.flatMap(([id, c], i) => [text(X, 530 + i * 72, 70, id, { font: 'mono', size: 22, weight: 600, color: C.skyInk, lh: 130 }), text(X + 80, 530 + i * 72, 800, c, { size: 22, color: C.ink, lh: 130 })]),
  ...phone(1090, 170, 330, IM.hold, 740), ...phone(1460, 170, 330, IM.release, 740),
  text(1090, 930, 330, 'NEEDS LAB → held', { font: 'mono', size: 18, color: C.muted, align: 'center', lh: 130 }),
  text(1460, 930, 330, 'PASS + tap → released', { font: 'mono', size: 18, color: C.muted, align: 'center', lh: 130 }),
], 'policy.md, six clauses, quoted verbatim in the app. The model can only downgrade an outcome. Release always needs a person\'s tap. All money here is SANDBOX.');

// 7 · coinbase
S('Coinbase', [
  rect(0, 0, W, H, { fill: C.violetTint }),
  ...frameChrome(7, 16, 'Coinbase · x402 · payment agents'),
  head(X, 160, 900, 'The verdict is the invoice.', 96, { color: C.ink }),
  ...chip(X, 300, 'TESTNET · BASE SEPOLIA', C.violetInk, 'rgba(122,92,255,0.16)'),
  ...[['01 · Pay', 'Escrow → supplier in USDC on Base, only after PASS and a pharmacist\u2019s tap.'], ['02 · Buy', 'No local reference? The agent pays another station\u2019s /verify over x402, capped per day.'], ['03 · Earn', 'Every station can sell /verify: 402 → sign → settle → 200 with the verdict and the rule id.']]
    .flatMap(([k, d], i) => [card(X, 390 + i * 170, 800, 150, { stroke: 'rgba(122,92,255,0.30)' }), rect(X + 22, 412 + i * 170, 6, 106, { fill: C.violet, radius: 3 }),
      text(X + 52, 414 + i * 170, 300, k, { font: 'mono', size: 22, weight: 600, color: C.violetInk, lh: 130 }),
      text(X + 52, 452 + i * 170, 720, d, { size: 25, color: C.ink, lh: 140 })]),
  ...phone(960, 170, 300, IM.verify, 720),
  ...browserShot(1290, 170, 510, IM.siteCoinbase),
  text(960, 910, 300, 'app · /verify over x402', { font: 'mono', size: 17, color: C.muted, align: 'center', lh: 130 }),
  text(1290, 910, 510, 'site · what Coinbase is for here', { font: 'mono', size: 17, color: C.muted, align: 'center', lh: 130 }),
], 'Coinbase moves only the money the verdict decides. Testnet USDC on Base Sepolia; nothing here is real money. Spend caps live in a text file the judge can read.', '#FFFFFF');

// 8 · app screens grid
S('App screens', [
  ...frameChrome(8, 16, 'The app'),
  head(X, 160, 1300, 'One app, the Pi touchscreen and the phone.', 84),
  body(X, 270, 1500, `20 routes in React. All ${appShotCount} app screenshots from our build passes (${appPhoneCount} phone, ${appShotCount - appPhoneCount} desktop) were imported into the Figma file automatically, one frame each, labelled with their route.`, { size: 26 }),
  ...gridPhones.flatMap((id, i) => phone(X + i * 212, 390, 196, id, 470)),
  ...['welcome', 'bottle', 'place', 'run', 'evaluation', 'delivery', 'medicines', 'calibration'].map((r, i) => text(X + i * 212, 880, 196, r, { font: 'mono', size: 17, color: C.muted, align: 'center', lh: 130 })),
], 'Same web app on the station\'s touchscreen and on any phone. The Design file has every screenshot on the "App screens" page, grouped by build pass, each frame linked to its route.');

// 9 · website
S('Website', [
  ...frameChrome(9, 16, 'The website'),
  head(X, 160, 700, 'pill-site.vercel.app', 76),
  body(X, 260, 640, 'Built code-first (Vite + anime.js) after a 16-persona panel scored a plain, honest page 8.0 against a copied storytelling site at 3.7. First live at 00:52 Saturday.', { size: 25 }),
  ...sitePhones.flatMap((id, i) => phone(X + i * 215, 520, 195, id, 400)),
  ...browserShot(820, 170, 980, IM.siteHero),
  text(820, 870, 980, 'Hero: the binary pill, drawn in characters. Words stay ink; colour lives in backgrounds and lines.', { font: 'mono', size: 18, color: C.muted, lh: 140 }),
], 'The website came first and set the tokens the app inherited.');

// 10 · workflow
const toolsShort = [
  ['Ideation', 'AI persona panels + reference study', 'FigJam board (generated after)'],
  ['Prototyping', 'Code-first phone mock + binary-pill HTML', 'Figma Make: Run → Evaluation'],
  ['Handoff', 'CSS tokens: site → app', 'Figma styles + variables ↔ CSS via Composio'],
  ['Code generation', 'Claude Code + 3 parallel builders', 'Pill → Figma plugin: design from code'],
];
// numbers on the slides come from STAGE-LOG.md; the short phrases are a summary of the same sections
const minShort = (s) => (s.minutes.match(/≈\d+/) || ['?'])[0] + ' min';
const rateShort = (s) => (s.rating.match(/\d\/5/) || ['?'])[0];
const pending = (s) => /\[fill after running\]/.test(s.minutes + s.rating);
S('Workflow', [
  ...frameChrome(10, 16, 'Workflow · idea to demo'),
  head(X, 160, 1500, 'Code first, then Figma from the code.', 92),
  ...toolsShort.flatMap(([stage, a, b], i) => {
    const x = X + i * 425, y = 330, w = 395, s = stages[i];
    return [card(x, y, w, 560), text(x + 32, y + 32, 200, `0${i + 1}`, { font: 'mono', size: 22, color: C.skyInk, weight: 600, lh: 120 }),
      text(x + 32, y + 72, w - 64, stage, { font: 'serif', size: 52, lh: 100 }),
      eyebrow(x + 32, y + 170, 'What we used', C.muted, w - 64), text(x + 32, y + 206, w - 64, a, { size: 25, lh: 135 }),
      rect(x + 32, y + 320, w - 64, 2, { fill: C.line }),
      eyebrow(x + 32, y + 346, 'Figma step', C.violetInk, w - 64), text(x + 32, y + 382, w - 64, b, { size: 25, lh: 135 }),
      text(x + 32, y + 500, w - 64, `${minShort(s)} · ${rateShort(s)}${pending(s) ? ' · Figma step pending' : ''}`, { font: 'mono', size: 18, color: C.muted, lh: 130 }),
      ...(i < 3 ? [text(x + w - 4, y + 240, 40, '→', { size: 40, color: C.sky, align: 'center', lh: 100 })] : [])];
  }),
  text(X, 925, 1680, 'Honest order: no Figma was used Friday or Saturday morning. The Figma files were generated from the repo afterwards, and the log says so.', { size: 24, color: C.ink2, lh: 140 }),
], 'We are a code-first team. Ideation and prototyping happened in markdown, AI panels and HTML. Figma enters as the place the repo is published to: slides, screens, tokens, ideation board.');

// 11 · stage log table
const stageShort = [
  ['16 AI personas per panel, reference study; FigJam board generated after', 'One model played all 16: agreement inflated (SD 0)', 'PLAN.md decisions, scope, site outline'],
  ['binary-pill.html, phone mock in the site’s JS; Figma Make prompt written', 'Nobody could click it without a code editor', 'APP-PLAN’s 12 screens, the pill fill'],
  ['CSS :root copied site → app; Figma styles + variables; Composio → CSS', '8 of 27 tokens arrived identical; no record of intent', 'App :root, Tokens page, tokens-from-figma.mjs'],
  ['Claude Code + 3 parallel builders; Pill → Figma plugin', 'P6 hold rule bug; double deploy; REST API can’t draw', 'App, payment service, this deck'],
];
const COLS = [[0, 'Stage', 250], [260, 'Tools', 470], [760, 'Minutes', 150], [920, 'Rating', 130], [1060, 'What broke', 330], [1410, 'Into the project', 270]];
S('Stage log', [
  ...frameChrome(11, 16, 'Stage log'),
  head(X, 150, 1500, 'Four stages, timed from git.', 84),
  ...COLS.map(([x, h, w]) => eyebrow(X + x, 290, h, C.muted, w)),
  ...stages.flatMap((s, i) => {
    const y = 340 + i * 150, [tools, broke, into] = stageShort[i];
    return [rect(X, y, W - 2 * X, 2, { fill: C.line }),
      text(X, y + 24, 250, s.name, { font: 'serif', size: 40, lh: 105 }),
      ...[tools, minShort(s), null, broke, into].map((v, j) => {
        const [x, , w] = COLS[j + 1];
        if (j === 2) return text(X + x, y + 24, w, rateShort(s) + (pending(s) ? '\n+ pending' : ''), { font: 'mono', size: 22, weight: 600, color: C.skyInk, lh: 130 });
        return text(X + x, y + 24, w, v, { size: 21, color: j === 0 ? C.ink : C.ink2, lh: 135, font: j === 1 ? 'mono' : 'sans' });
      })];
  }),
  text(X, 950, 1680, '"Pending" = the Figma step is written but not yet run; its minutes and rating are left blank in the log, not estimated.', { size: 19, color: C.muted, lh: 140 }),
], 'Full log with what broke in STAGE-LOG.md. Minutes come from commit timestamps. Steps not yet run say so.');

// 12 · design from code
const pipe = [['Repo', 'screenshots · CSS :root · debate JSON · STAGE-LOG.md'], ['build-deck.mjs', 'Node, no npm deps; ffmpeg or sips for images'], ['deck.json', 'slides + pages + board, one file'], ['Pill → Figma plugin', 'Slides · Design · FigJam'], ['Composio', 'comment · dev resources · thumbnails · tokens → CSS']];
S('Design from code', [
  ...frameChrome(12, 16, 'The Figma step'),
  head(X, 160, 1400, [{ s: 'This deck was ' }, { s: 'generated from the repo.', italic: true }], 92),
  ...pipe.flatMap(([k, d], i) => {
    const x = X + i * 345, y = 380, w = 300;
    return [card(x, y, w, 240, { fill: i === 3 ? C.violetTint : C.surface, stroke: i === 3 ? 'rgba(122,92,255,0.35)' : C.line }),
      text(x + 28, y + 30, w - 56, k, { font: 'mono', size: 23, weight: 600, color: i === 3 ? C.violetInk : C.ink, lh: 130 }),
      text(x + 28, y + 100, w - 56, d, { size: 22, color: C.ink2, lh: 140 }),
      ...(i < 4 ? [text(x + w, y + 90, 40, '→', { size: 36, color: C.sky, align: 'center', lh: 100 })] : [])];
  }),
  text(X, 690, 1680, 'Recipe for code-first teams: keep the repo as the source of truth, emit one JSON, let a plugin draw it. One run gives designers editable layers, every screen, the tokens as styles, and a board of how you decided.', { size: 28, color: C.ink, lh: 145 }),
  text(X, 860, 1680, 'Why a plugin: the Figma REST API and our Composio connector can read, comment and set variables, but cannot create layers or slides. The Plugin API can.', { size: 24, color: C.ink2, lh: 145 }),
], 'The REST API cannot draw. So the repo emits deck.json and a 1-file plugin draws it in whichever editor it is opened in. Composio then closes the loop: comments, dev resources back to the code, thumbnails, and tokens back to CSS.');

// 13 · before / after (filled after measurement)
S('Before and after', [{ t: 'metrics' }], 'Before numbers are estimates and say so. After numbers are measured on this machine; the real Figma run time is printed by the plugin.');

// 14 · limits
S('What PASS does not mean', [
  ...frameChrome(14, 16, 'What PASS does not mean'),
  head(X, 160, 1400, 'Pill screens tablets. It does not certify them.', 92),
  card(X, 400, 810, 400, { fill: C.mintTint, stroke: 'rgba(95,211,154,0.45)' }),
  eyebrow(X + 40, 440, 'PASS means', C.mintInk, 700),
  text(X + 40, 490, 730, "The dissolution curve of this one tablet, on this box, was consistent with last night's riboflavin reference runs. No red flags found.", { size: 28, lh: 145 }),
  card(X + 870, 400, 810, 400, { fill: C.amberTint, stroke: 'rgba(224,154,58,0.40)' }),
  eyebrow(X + 910, 440, 'PASS does not mean', C.amberInk, 700),
  text(X + 910, 490, 730, 'That the tablet is the right drug, the right dose, or free of contaminants. Pill has one reference drug today. Anything it cannot compare goes to a lab, by design.', { size: 28, lh: 145 }),
  text(X, 860, 1680, 'Results charts on our site are marked as an illustration until the calibration runs are on the page.', { size: 24, color: C.ink2, lh: 140 }),
], 'Say the limits before a judge asks. One reference drug (riboflavin). Charts marked illustration until real runs land.');

// 15 · tracks
const tracks = [
  ['Figma · Idea to Demo', C.violet, 'this deck, the plugin, the stage log'], ['Hardware Hack', C.sky, 'the station, on the table'], ['Hyphenate · finance agents', C.sky, 'policy agent: proposes, holds, escalates'],
  ['Coinbase · x402 payment agents', C.violet, '/verify over x402, USDC escrow (TESTNET)'], ['Capital One · Nessie', C.amber, 'hold / release / refund (SANDBOX)'], ['Microsoft · Built for the Real World', C.sky, 'a clinic pharmacist’s delivery check'],
  ['Anthropic · Claude', C.mint, 'the plain-English why; can only downgrade'], ['People-First', C.mint, 'personal mode, read aloud'], ['Most Technically Complex', C.sky, 'two-channel optics + rules + payments'],
  ['MLH · Gemini API', C.mint, 'reads the bottle label'], ['MLH · ElevenLabs', C.mint, 'reads the verdict aloud'], ['MLH · Gen AI', C.mint, 'models explain; rules decide'],
];
S('Tracks', [
  ...frameChrome(15, 16, 'Tracks'),
  head(X, 160, 1400, 'One build, many judges.', 96),
  ...tracks.flatMap(([t, c, sub], i) => {
    const col = i % 3, row = Math.floor(i / 3), x = X + col * 570, y = 320 + row * 158;
    return [card(x, y, 540, 136, { radius: 20 }), rect(x + 22, y + 26, 6, 84, { fill: c, radius: 3 }),
      text(x + 50, y + 26, 470, t, { size: 27, weight: 600, lh: 130 }), text(x + 50, y + 70, 470, sub, { size: 21, color: C.ink2, lh: 135 })];
  }),
], 'Each track gets the same product; only the emphasis changes.');

// 16 · ask / next
S('Ask and next', [
  ...frameChrome(16, 16, 'Next'),
  head(X, 160, 1500, [{ s: 'Next: ' }, { s: 'real runs, one clinic.', italic: true }], 104),
  ...[['1', 'Calibration on the real box', 'Ten riboflavin reference runs and chalk runs, plotted on the site in place of the illustration.'], ['2', 'A second reference drug', 'Each new drug needs its own band. Until then it is UNABLE TO VERIFY, on purpose.'], ['3', 'One pharmacy, one week', 'A procurement officer samples one tablet per delivery; we log every decision and every override.']]
    .flatMap(([n, k, d], i) => [text(X, 360 + i * 170, 80, n, { font: 'serif', size: 80, color: C.sky, lh: 100 }), text(X + 110, 370 + i * 170, 1400, k, { size: 34, weight: 600, lh: 130 }), text(X + 110, 422 + i * 170, 1400, d, { size: 27, color: C.ink2, lh: 140 })]),
  card(X, 860, 1680, 110, { fill: C.skyTint, stroke: 'rgba(79,179,255,0.35)', radius: 20 }),
  text(X + 40, 894, 1600, 'Ask: tell us which tablet to calibrate next, and introduce us to one clinic pharmacist.', { size: 30, weight: 500, lh: 130 }),
], 'Close on what is still not done and what we need.');

// ───────────────────────────── design pages + board ─────────────────────────────
const design = {
  appScreens: { title: 'App screens', note: `Every app screenshot from pill/web/dev-shots (${appShotCount}), grouped by build pass in the order they were taken. Phone frames are 390 wide; each frame name is "App · <file>" and maps to a route.`, groups: appGroups },
  website: { title: 'Website', note: `Every site screenshot from pill-site/dev-shots (${siteShotCount}; Peel-era shots excluded). Live: https://pill-site.vercel.app`, groups: siteGroups },
  tokens: { title: 'Tokens', note: `From pill/web/src/index.css :root (${appVars.length} declarations, ${tokens.length} unique tokens: ${tokenColors.length} colours → paint styles + COLOR variables, ${tokenNumbers.length} sizes → FLOAT variables). The app copied them by hand from pill-site/src/styles.css: ${drift.identical} of ${siteVars.length} arrived identical, ${drift.changed.length} changed value, ${drift.missing.length} were renamed or dropped.`, items: tokens, drift },
  stageLog: { title: 'Stage log', columns: stages.map((s) => s.name), rows: [['Tools', 'tools'], ['Minutes', 'minutes'], ['Rating (1–5)', 'rating'], ['What we did', 'did'], ['What broke', 'broke'], ['Into the project', 'forward']].map(([label, k]) => ({ label, cells: stages.map((s) => s[k]) })) },
};
const ideasBefore = [
  ['Fri 19:40', 'Shortlist: Custody / Sensor Market / Egress', 'kit + niche tracks'],
  ['Fri 20:05', 'FloodToll rejected as a business', '18 AI personas: startup 2/10'],
  ['Fri 21:00', 'DripGuard picked 18/18, then dropped', 'cannot get IV sets'],
  ['Fri 21:40', 'Payout picked 18/18, then dropped', 'no solar panel; sensor accuracy'],
];
const figjam = {
  title: 'Pill · ideation board',
  subtitle: 'Generated after the fact by the Pill → Figma plugin from the repo (PLAN.md, final-debate-2026-10-23.json, website-debate-2026-10-24.md). The debates ran Friday night in code; no FigJam was used live. All personas are AI role-play by one model, so agreement is inflated.',
  sections: [
    { title: 'Ideas that died first · Fri 19:40–21:40', color: C.grey, stickies: ideasBefore.map(([t, a, b]) => ({ text: `${t}\n${a}\n— ${b}`, color: '#E6E6E6' })) },
    { title: 'Final three · 16 AI personas · Fri 22:00', color: C.sky, shapes: [
      { text: 'Lot (became Pill)\nhack 7.5 · impact 7.4 · build 6.3 · startup 4.8\n13 votes', color: C.mint, winner: true },
      { text: 'Bill (price-transparency auditor)\nhack 4.9 · impact 6.4 · build 8.1 · startup 4.9\n1 vote', color: '#F5D6A8' },
      { text: 'Streets (road safety)\nhack 6.4 · impact 5.6 · build 4.5 · startup 3.5\n2 votes', color: '#CDE8FF' },
    ] },
    { title: 'Final votes · one sticky per persona', color: C.mint, stickies: finalVotes.map((v) => ({ text: `${v.who} → ${v.pick}\n${v.why.slice(0, 140)}${v.why.length > 140 ? '…' : ''}`, color: v.pick === 'LOT' ? '#C9F0DC' : v.pick === 'BILL' ? '#F5D6A8' : '#CDE8FF' })) },
    { title: 'Website panel · Fri 23:28 · copy a storytelling site vs plain + honest', color: C.amber, stickies: siteDebate.map((d) => ({ text: `${d.who}\nstorytelling ${d.story} · plain ${d.plain}`, color: '#FFF1C2' })) },
    { title: 'Decisions', color: C.violet, stickies: [
      { text: 'Fri 22:00 · Pill beats Bill and Streets 13/16\nsensor → one honest number → money decision', color: '#C9F0DC' },
      { text: 'Fri 22:25 · Clinic mode first; personal mode kept\n16/16 personas said clinic only; owner kept both', color: '#E3DBFF' },
      { text: 'Fri 22:50 · Name: Pill', color: '#E3DBFF' },
      { text: 'Fri 23:55 · Website: plain, fast, honest page\n8.0 vs 3.7; "2 h on the site, 6 on test data"', color: '#E3DBFF' },
      { text: 'Caveat · one base model played all 16 personas; plain-page SD was 0. Read as one strong opinion from 16 angles.', color: '#FFD6D6' },
    ] },
  ],
};

// ───────────────────────────── assemble, measure, write ─────────────────────────────
function metricsSlide(m) {
  const before = [
    [`${m.slides} slides by hand`, `${m.slides} × ${m.perSlideMin} min = ${m.slides * m.perSlideMin} min`],
    [`${m.screens} screenshots placed + labelled`, `${m.screens} × ${m.perShotMin} min = ${m.screens * m.perShotMin} min`],
    [`${m.tokenCount} tokens as styles`, `${m.tokenCount} × ${m.perTokenMin} min = ${m.tokenCount * m.perTokenMin} min`],
  ];
  const after = [
    ['repo → deck.json + deck.html', `${m.buildCold ?? m.buildSec} s cold · ${m.buildSec} s this run`],
    ['plugin logic, stub Figma API', `${m.pluginStubMs.slides} ms Slides · ${m.pluginStubMs.figma} ms Design`],
    ['plugin in real Figma', m.realFigmaSec ? `${m.realFigmaSec} s` : '[fill after running]'],
  ];
  return [
    ...frameChrome(13, 16, 'Before and after'),
    head(X, 150, 1500, 'From hours to one click.', 92),
    eyebrow(X, 300, 'Before · by hand · ESTIMATE', C.amberInk, 800),
    ...before.flatMap(([k, v], i) => [text(X, 350 + i * 96, 760, k, { size: 28, lh: 130 }), text(X, 390 + i * 96, 760, v, { font: 'mono', size: 21, color: C.muted, lh: 130 })]),
    text(X, 650, 760, `≈ ${Math.round((m.slides * m.perSlideMin + m.screens * m.perShotMin + m.tokenCount * m.perTokenMin) / 60 * 10) / 10} h`, { font: 'serif', size: 120, color: C.amberInk, lh: 100 }),
    text(X, 790, 760, `Per-unit figures are our assumption (${m.perSlideMin} min/slide, ${m.perShotMin} min/screenshot, ${m.perTokenMin} min/token), not a measurement.`, { size: 20, color: C.ink2, lh: 140 }),
    rect(960, 300, 2, 600, { fill: C.line }),
    eyebrow(1020, 300, 'After · the plugin · MEASURED', C.mintInk, 800),
    ...after.flatMap(([k, v], i) => [text(1020, 350 + i * 96, 780, k, { size: 28, lh: 130 }), text(1020, 390 + i * 96, 780, v, { font: 'mono', size: 21, color: C.muted, lh: 130 })]),
    text(1020, 650, 780, `${m.screens}`, { font: 'serif', size: 120, color: C.mintInk, lh: 100 }),
    text(1260, 666, 540, `screenshots placed per run, no hand work (${m.appShots} app, ${m.siteShots} site); ${m.tokenCount} CSS variables become Figma styles + variables. Counted on the stub run.`, { size: 22, color: C.ink, lh: 140 }),
    text(1020, 790, 780, `Hand handoff drift: ${m.drift.identical} of ${m.drift.siteTotal} site tokens reached the app unchanged, ${m.drift.changed} changed value, ${m.drift.missing} renamed or dropped.`, { size: 20, color: C.ink2, lh: 140 }),
  ];
}

const prev = fs.existsSync(path.join(HERE, 'metrics.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'metrics.json'), 'utf8')) : {};
const m = {
  slides: slides.length, perSlideMin: 20, perShotMin: 1, perTokenMin: 1,
  screens: appShotCount + siteShotCount, appShots: appShotCount, siteShots: siteShotCount,
  tokenCount: tokens.filter((t) => t.kind !== 'text').length,
  drift: { identical: drift.identical, changed: drift.changed.length, missing: drift.missing.length, siteTotal: siteVars.length },
  imagesConverted: converted, realFigmaSec: prev.realFigmaSec ?? null, buildCold: prev.buildCold ?? null,
};
const deck = {
  plugin: 'Pill → Figma', version: 1, generatedAt: new Date().toISOString(), title: 'Pill — The box measures. Pill explains.',
  size: { w: W, h: H }, palette: C, fonts: FONTS, images: {}, slides, design, figjam, metrics: m,
};
const stripB64 = () => Object.fromEntries(Object.entries(IMAGES).map(([k, v]) => [k, { w: v.w, h: v.h, mime: v.mime, b64: v.b64 }]));
deck.images = stripB64();
const mIdx = slides.findIndex((s) => s.els[0]?.t === 'metrics');

// measure the plugin's own logic against a stub figma API (Node), then fill slide 13
m.pluginStubMs = { slides: 0, figma: 0, figjam: 0 };
slides[mIdx].els = metricsSlide({ ...m, buildSec: '…' });
m.pluginStubMs = await measurePlugin(deck);
m.buildSec = +((performance.now() - T0) / 1000).toFixed(1);
if (converted > 50 || m.buildCold == null) m.buildCold = m.buildSec;
slides[mIdx].els = metricsSlide(m);
deck.metrics = m;

const json = JSON.stringify(deck);
fs.writeFileSync(path.join(HERE, 'deck.json'), json);
fs.writeFileSync(path.join(HERE, 'metrics.json'), JSON.stringify({ ...m, at: deck.generatedAt, deckBytes: json.length, stageWords: stages.map((s) => ({ stage: s.name, words: s.words })) }, null, 2) + '\n');

// ───────────────────────────── deck.html ─────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FAM = { sans: "'Inter', system-ui, sans-serif", serif: "'Instrument Serif', Georgia, serif", mono: "'JetBrains Mono', ui-monospace, monospace" };
function elHtml(e) {
  const box = `left:${e.x}px;top:${e.y}px;width:${e.w}px;`;
  if (e.t === 'text') {
    const segs = Array.isArray(e.text) ? e.text : [{ s: e.text }];
    const inner = segs.map((g) => {
      const st = [g.color && `color:${g.color}`, g.italic && 'font-style:italic', g.weight && `font-weight:${g.weight}`].filter(Boolean).join(';');
      return st ? `<span style="${st}">${esc(g.s)}</span>` : esc(g.s);
    }).join('');
    return `<div class="tx" style="${box}font-family:${FAM[e.font]};font-size:${e.size}px;font-weight:${e.weight};${e.italic ? 'font-style:italic;' : ''}color:${e.color};line-height:${e.lh / 100};letter-spacing:${e.ls / 100}em;text-align:${e.align}">${inner}</div>`;
  }
  const stroke = e.stroke ? `box-shadow:inset 0 0 0 ${e.strokeW || 2}px ${e.stroke}${e.shadow ? ',0 30px 60px -30px rgba(22,24,27,.35)' : ''};` : e.shadow ? 'box-shadow:0 30px 60px -30px rgba(22,24,27,.35);' : '';
  if (e.t === 'rect') return `<div style="${box}height:${e.h}px;background:${e.fill};border-radius:${e.radius}px;${stroke}"></div>`;
  if (e.t === 'ellipse') return `<div style="${box}height:${e.h}px;background:${e.fill || 'transparent'};border-radius:50%;${stroke}"></div>`;
  if (e.t === 'image') {
    const im = IMAGES[e.img];
    const size = e.fit === 'contain' ? 'contain' : e.fit === 'top' ? (im.h / im.w > e.h / e.w ? '100% auto' : 'cover') : 'cover';
    return `<div style="${box}height:${e.h}px;border-radius:${e.radius}px;background:url('${path.relative(HERE, path.join(ROOT, im.file))}') ${e.fit === 'top' ? 'top center' : 'center'} / ${size} no-repeat"></div>`;
  }
  if (e.t === 'capsule') {
    const vert = e.h >= e.w, r = Math.min(e.w, e.h) / 2;
    const fill = vert ? `left:0;right:0;bottom:0;height:${e.level * 100}%` : `left:0;top:0;bottom:0;width:${e.level * 100}%`;
    return `<div style="${box}height:${e.h}px;border-radius:${r}px;background:${e.track};overflow:hidden;box-shadow:inset 0 0 0 ${e.strokeW}px ${e.stroke}"><div style="position:absolute;${fill};background:${e.fill}"></div></div>`;
  }
  return '';
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(deck.title)} · deck preview</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:"Instrument Serif";src:url("../pill-site/public/fonts/instrument-serif-400.woff2") format("woff2");font-weight:400}
@font-face{font-family:"Instrument Serif";src:url("../pill-site/public/fonts/instrument-serif-400-italic.woff2") format("woff2");font-weight:400;font-style:italic}
@font-face{font-family:"Inter";src:url("../pill-site/public/fonts/inter-400.woff2") format("woff2");font-weight:400}
@font-face{font-family:"Inter";src:url("../pill-site/public/fonts/inter-500.woff2") format("woff2");font-weight:500}
@font-face{font-family:"Inter";src:url("../pill-site/public/fonts/inter-600.woff2") format("woff2");font-weight:600 700}
@font-face{font-family:"JetBrains Mono";src:url("../pill-site/public/fonts/jetbrains-mono-400.woff2") format("woff2");font-weight:400}
@font-face{font-family:"JetBrains Mono";src:url("../pill-site/public/fonts/jetbrains-mono-500.woff2") format("woff2");font-weight:500 700}
html,body{margin:0;background:#D9DCDA}
body{-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11"}
.deck{display:flex;flex-direction:column;align-items:center;gap:40px;padding:40px 0}
.slide{position:relative;width:1920px;height:1080px;overflow:hidden;flex:none;transform-origin:top left}
.slide>div{position:absolute}
.tx{white-space:pre-wrap;overflow-wrap:break-word}
.notes{width:1920px;font:20px/1.5 Inter,sans-serif;color:#4A4E55;margin-top:-28px}
body.one .deck{padding:0;gap:0}body.one .notes{display:none}body.one .slide{display:none}body.one .slide.on{display:block}
</style></head><body>
<div class="deck">
${slides.map((s, i) => `<section class="slide" id="${s.id}" data-name="${esc(s.name)}" style="background:${s.bg}">\n${s.els.map(elHtml).join('\n')}\n</section>\n<p class="notes"><b>${i + 1}. ${esc(s.name)}</b> · notes: ${esc(s.notes)}</p>`).join('\n')}
</div>
<script>
// ?slide=N shows one slide at 1920×1080 (screenshots); ?present scales one slide to the window, ←/→ to move.
const q=new URLSearchParams(location.search),S=[...document.querySelectorAll('.slide')];let i=Math.max(0,(+q.get('slide')||1)-1);
function show(){S.forEach((s,k)=>s.classList.toggle('on',k===i));if(q.has('present')){const k=Math.min(innerWidth/1920,innerHeight/1080);S[i].style.transform='scale('+k+')';document.body.style.background='#000';S[i].style.margin=((innerHeight-1080*k)/2)+'px 0 0 '+((innerWidth-1920*k)/2)+'px'}}
if(q.has('slide')||q.has('present')){document.body.classList.add('one');show();addEventListener('resize',show);addEventListener('keydown',e=>{if(/Right|Down| |PageDown/.test(e.key))i=Math.min(S.length-1,i+1);if(/Left|Up|PageUp/.test(e.key))i=Math.max(0,i-1);show()})}
else{const fit=()=>{const k=Math.min(1,(innerWidth-40)/1920);S.forEach(s=>{s.style.transform='scale('+k+')';s.style.marginBottom=(1080*k-1080)+'px';s.style.marginRight=(1920*k-1920)+'px'})};fit();addEventListener('resize',fit)}
</script>
</body></html>
`;
fs.writeFileSync(path.join(HERE, 'deck.html'), html);

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`deck.json  ${mb(json.length)}  · ${slides.length} slides · ${Object.keys(IMAGES).length} images (${converted} converted this run)`);
console.log(`Design     App screens ${appShotCount} (${appGroups.length} groups) · Website ${siteShotCount} · Tokens ${tokens.length} (${tokenColors.length} colours, ${tokenNumbers.length} sizes) · Stage log 4×6`);
console.log(`FigJam     ${figjam.sections.length} sections · ${figjam.sections.reduce((n, s) => n + (s.stickies?.length || 0) + (s.shapes?.length || 0), 0)} stickies/shapes`);
console.log(`plugin     stub run: ${m.pluginStubMs.slides} ms slides · ${m.pluginStubMs.figma} ms design · ${m.pluginStubMs.figjam} ms figjam`);
console.log(`deck.html  ${mb(html.length)} · build ${m.buildSec} s`);
console.log(`stage log  ${stages.map((s) => `${s.name} ${s.words}w`).join(' · ')}`);
if (json.length > 8 * 1048576) console.warn('WARNING: deck.json is over 8 MB');
