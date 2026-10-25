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
const PHONE = { w: 390, cap: 2.2, q: 12 };     // gallery + slide phones: 390 wide, at most 390×858
const DESK = { w: 640, cap: 0.75, q: 12 };     // gallery desktops: 640 wide, at most 640×480 (keeps deck.json under 9 MB)
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
/** Register a screenshot; returns its image id. spec = { w: max width, cap: max height/width (0 = none), q: ffmpeg -q:v, box: [x, y, w, h] fractions to crop to (ffmpeg only) }. */
function img(src, spec = PHONE) {
  const abs = path.isAbsolute(src) ? src : path.join(ROOT, src);
  const id = rel(abs).replace(/^pill\/web\/dev-shots\//, 'app/').replace(/^pill-site\/dev-shots\//, 'site/').replace(/\.[a-z]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-') + '-' + spec.w + (spec.cap ? 'c' : '') + (spec.box ? 'k' : '');
  if (IMAGES[id]) return id;
  const out = path.join(ASSETS, `${id}-q${spec.q}.jpg`);
  const [d] = dimsOf([abs]);
  const cropped = HAS_FFMPEG && spec.cap > 0 && d.h / d.w > spec.cap + 0.02;
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(abs).mtimeMs) {
    if (HAS_FFMPEG) {
      const crop = spec.box ? `crop=iw*${spec.box[2]}:ih*${spec.box[3]}:iw*${spec.box[0]}:ih*${spec.box[1]},` : spec.cap ? `crop=iw:'min(ih,trunc(iw*${spec.cap}))':0:0,` : '';
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
  appstory: 'Story + settings', v2: 'App v2 · every route', v3: 'App v3 · first polish', live: 'App · live deploy', round3: 'Round 3 · agent + ask',
  upgrade: 'App v3 · upgrade pass (newest)',
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
    if (!groups.has(key)) groups.set(key, { key, items: [], t: Infinity, dir: !!relDir && !isSite });
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
    sub: `${g.items.length} screenshot${g.items.length === 1 ? '' : 's'} · first taken ${hhmm(g.t)} PDT · ${isSite ? 'pill-site/dev-shots' : 'pill/web/dev-shots/' + (g.dir ? g.key : g.key + '-*')}`,
    items: g.items.sort((a, b) => (a.kind === b.kind ? a.t - b.t : a.kind === 'phone' ? -1 : 1)).map(({ t, ...it }) => it),
  }));
}
const appGroups = screenGroups('pill/web/dev-shots', false);
const siteGroups = screenGroups('pill-site/dev-shots', true);
const count = (gs, kind) => gs.reduce((n, g) => n + g.items.filter((i) => !kind || i.kind === kind).length, 0);
const appShotCount = count(appGroups), siteShotCount = count(siteGroups), appPhoneCount = count(appGroups, 'phone');

// ───────────────────────────── element helpers ─────────────────────────────
// Element types (deck.html and plugin/code.js render exactly these): text, rect, ellipse, image, capsule, path.
// House rule: words are ink (white on dark panels); colour lives only in fills, lines, chips and art.
const W = 1920, H = 1080, X = 120, TOTAL = 21;
const text = (x, y, w, t, o = {}) => ({ t: 'text', x, y, w, text: t, size: 30, font: 'sans', weight: 400, color: C.ink, lh: 140, ls: 0, align: 'left', ...o });
const eyebrow = (x, y, t, w = 1200, o = {}) => text(x, y, w, t.toUpperCase(), { font: 'mono', size: 20, weight: 500, ls: 14, color: C.muted, lh: 120, ...o });
const head = (x, y, w, t, size = 104, o = {}) => text(x, y, w, t, { font: 'serif', size, lh: 100, ls: -1.5, ...o });
const body = (x, y, w, t, o = {}) => text(x, y, w, t, { size: 30, color: C.ink2, lh: 145, ...o });
const mono = (x, y, w, t, o = {}) => text(x, y, w, t, { font: 'mono', size: 17, color: C.muted, lh: 140, ...o });
const rect = (x, y, w, h, o = {}) => ({ t: 'rect', x, y, w, h, fill: C.surface, radius: 0, ...o });
const card = (x, y, w, h, o = {}) => rect(x, y, w, h, { fill: C.surface, radius: 28, stroke: C.line, strokeW: 2, ...o });
const image = (x, y, w, h, id, o = {}) => ({ t: 'image', x, y, w, h, img: id, radius: 0, fit: 'top', ...o });
const capsule = (x, y, w, h, level, o = {}) => ({ t: 'capsule', x, y, w, h, level, fill: C.sky, track: C.surface, stroke: C.sky, strokeW: 4, ...o });
const r1 = (n) => Math.round(n * 10) / 10;
/** Raw vector: SVG path data (M/L/C/Z, absolute, space-separated) in a w×h box at x,y. */
const curve = (x, y, w, h, d, stroke, o = {}) => ({ t: 'path', x, y, w, h, d, stroke, strokeW: o.w ?? 3, dash: o.dash || null, fill: null });
/** Polyline through slide-coordinate points, with an arrow head at the end unless o.head === false. */
function line(pts, stroke, o = {}) {
  const sw = o.w ?? 3, hl = o.head === false ? 0 : (o.headLen ?? 14);
  const all = [...pts];
  let tips = [];
  if (hl) {
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], a = Math.atan2(by - ay, bx - ax);
    tips = [-0.5, 0.5].map((da) => [bx - hl * Math.cos(a + da), by - hl * Math.sin(a + da)]);
    all.push(...tips);
  }
  const x0 = Math.floor(Math.min(...all.map((p) => p[0])) - sw), y0 = Math.floor(Math.min(...all.map((p) => p[1])) - sw);
  const x1 = Math.ceil(Math.max(...all.map((p) => p[0])) + sw), y1 = Math.ceil(Math.max(...all.map((p) => p[1])) + sw);
  const P = ([x, y]) => `${r1(x - x0)} ${r1(y - y0)}`;
  let d = `M ${P(pts[0])}` + pts.slice(1).map((p) => ` L ${P(p)}`).join('');
  if (hl) d += ` M ${P(tips[0])} L ${P(pts[pts.length - 1])} L ${P(tips[1])}`;
  return curve(x0, y0, x1 - x0, y1 - y0, d, stroke, { w: sw, dash: o.dash });
}
/** Chip: tinted pill, ink label (o.fg only for white-on-dark), optional coloured dot. Width from JetBrains Mono's 0.6 em advance. */
const chipW = (label, o = {}) => { const s = o.size || 20; return o.w || Math.round(label.length * s * 0.66 + s * 2.2 + (o.dot ? s : 0)); };
function chip(x, y, label, bg, o = {}) {
  const s = o.size || 20, h = Math.round(s * 2), w = chipW(label, o), dot = o.dot ? Math.round(s * 0.5) : 0;
  const els = [rect(x, y, w, h, { fill: bg, radius: h / 2, ...(o.stroke ? { stroke: o.stroke, strokeW: 2 } : {}) })];
  if (dot) els.push({ t: 'ellipse', x: Math.round(x + s), y: Math.round(y + (h - dot) / 2), w: dot, h: dot, fill: o.dot });
  const tx = dot ? Math.round(x + s + dot + s * 0.4) : x;
  els.push(text(tx, y + (h - s * 1.2) / 2, dot ? w - (tx - x) - Math.round(s * 0.6) : w, label, { font: 'mono', size: s, weight: 600, color: o.fg || C.ink, align: dot ? 'left' : 'center', lh: 120, ls: 6 }));
  return els;
}
/** Chips left to right; items = [label, bg, opts]. */
function chipRow(x, y, items, gap = 14) {
  let cx = x;
  return items.flatMap(([label, bg, o = {}]) => { const els = chip(cx, y, label, bg, o); cx += chipW(label, o) + gap; return els; });
}
const VERDICT = { PASS: [C.mintTint, C.mint], 'NEEDS LAB': [C.amberTint, C.amber], 'UNABLE TO VERIFY': [C.greyTint, C.grey] };
const vchip = (word, o = {}) => [word, VERDICT[word][0], { dot: VERDICT[word][1], ...o }];
/** Phone mock: rounded white bezel + screenshot cropped from the top. */
function phone(x, y, w, id, h = Math.round(w * 2.05)) {
  const pad = Math.round(w * 0.028);
  return [rect(x, y, w, h, { fill: C.surface, radius: Math.round(w * 0.13), stroke: C.line2, strokeW: 2, shadow: true }),
    image(x + pad, y + pad, w - 2 * pad, h - 2 * pad, id, { radius: Math.round(w * 0.11) })];
}
function browserShot(x, y, w, id, h, fit = 'top') {
  const meta = IMAGES[id];
  const ih = h ?? Math.round((w * meta.h) / meta.w);
  return [rect(x, y, w, ih + 44, { fill: C.surface, radius: 22, stroke: C.line2, strokeW: 2, shadow: true }),
    ...[0, 1, 2].map((i) => ({ t: 'ellipse', x: x + 22 + i * 24, y: y + 15, w: 14, h: 14, fill: ['#FF6159', '#FFBD2E', '#28C941'][i] })),
    image(x + 2, y + 44, w - 4, ih - 2, id, { radius: 0, fit })];
}
function logo(x, y, s = 1) {
  return [capsule(x, y, 64 * s, 28 * s, 0.5, { fill: C.mint, stroke: C.ink, strokeW: 2, track: C.surface }),
    text(x + 78 * s, y - 3 * s, 200, 'Pill', { font: 'serif', size: 34 * s, lh: 100 })];
}
/** Header (logo, section, n / total) and footer rule; n defaults to the slide being built. */
function chrome(label, o = {}) {
  const n = o.n || slides.length + 1;
  return [...logo(X, 56, 0.8), mono(X + 260, 58, 1000, label.toUpperCase(), { size: 18, weight: 500, ls: 14, lh: 130 }),
    mono(W - X - 400, 58, 400, `${String(n).padStart(2, '0')} / ${TOTAL}`, { size: 18, weight: 500, ls: 10, align: 'right', lh: 130 }),
    ...(o.footer === false ? [] : [rect(X, H - 70, W - 2 * X, 2, { fill: C.line }), mono(X, H - 54, 1200, 'Pill · Cal Hacks 13.0 · pill-site.vercel.app', { size: 18, ls: 6, lh: 130 })])];
}

// ───────────────────────────── slide images ─────────────────────────────
// App phones: the newest build pass (dev-shots/upgrade) when a shot exists there, else the older pass named next.
const SHOTS = 'pill/web/dev-shots';
function newest(...cands) {
  for (const c of cands) if (fs.existsSync(path.join(ROOT, SHOTS, c))) return img(`${SHOTS}/${c}`);
  throw new Error(`no screenshot among ${cands.join(', ')}`);
}
const APP = {
  welcome: newest('upgrade/a-onboarding-390.webp', 'v2/welcome-phone.webp'),
  bottle: newest('upgrade/b-bottle-390.webp', 'e2e/03-bottle.webp'),
  place: newest('upgrade/b-place-390.webp', 'v2/place-phone.webp'),
  run: newest('upgrade/b-run-390.webp', 'pillmotion-run-mid-phone.webp'),
  pass: newest('upgrade/b-evaluation-pass-390.webp', 'runeval-eval-pass.webp'),
  needsLab: newest('upgrade/b-evaluation-needslab-390.webp', 'pillmotion-eval-needslab-phone.webp'),
  unable: newest('upgrade/b-evaluation-unable-390.webp', 'upgrade/b-evaluation-u1-390.webp', 'pillmotion-eval-u1-phone.webp'),
  held: newest('upgrade/b-delivery-held-policy-390.webp', 'flowsb-delivery-hold.webp'),
  heldTop: newest('upgrade/b-delivery-held-390.webp', 'flowsb-delivery-hold.webp'),
  released: newest('upgrade/b-delivery-released-390.webp', 'payreal-delivery-release-live-phone.webp'),
  verify: newest('upgrade/b-verify-390.webp', 'payreal-verify-real402-phone.webp'),
  home: newest('upgrade/a-home-390.webp', 'v3/dashboard.webp'),
  medicines: newest('upgrade/a-medicines-390.webp', 'v2/medicines-phone.webp'),
  ask: newest('upgrade/b-ask-390.webp', 'round3-ask-phone.webp'),
};
// Station phases (dev-shots/phases, one shot per phase, newest app pass) and the Gemini checker + follower (dev-shots/gemini).
// Older passes are listed second only so the deck still builds on a checkout without the newest shots.
const RAIL_PHONE = { w: 320, cap: 1.8, q: 12 }, TALL_PHONE = { w: 340, cap: 2.2, q: 12 };
const shot = (spec, ...cands) => {
  for (const c of cands) if (fs.existsSync(path.join(ROOT, SHOTS, c))) return img(`${SHOTS}/${c}`, spec);
  throw new Error(`no screenshot among ${cands.join(', ')}`);
};
const PHASE_SHOT = {
  dark: shot(RAIL_PHONE, 'phases/02-dark-390.webp', 'pillmotion-place-phone-checking.webp'),
  water: shot(RAIL_PHONE, 'phases/03-water-390.webp', 'pillmotion-place-phone.webp'),
  drop: shot(RAIL_PHONE, 'phases/04-drop-390.webp', 'upgrade/b-place-390.webp'),
  dissolving: shot(RAIL_PHONE, 'phases/05-dissolving-390.webp', 'pillmotion-run-mid-phone.webp'),
  settling: shot(RAIL_PHONE, 'phases/06-settling-390.webp', 'upgrade/b-run-390.webp'),
  verdict: shot(RAIL_PHONE, 'phases/07-verdict-390.webp', 'upgrade/b-evaluation-needslab-390.webp'),
};
const GEMINI_SHOT = {
  steps: shot(TALL_PHONE, 'gemini/checker-steps-390.webp'),
  report: shot(TALL_PHONE, 'gemini/checker-report-390.webp'),
  follower: shot(TALL_PHONE, 'gemini/follower-open-390.webp'),
};
// Pill Gate, the station app (pillgate/: FastAPI + Arduino UNO Q)
const GATE = 'pillgate/dev-shots/ui';
const GATE_SHOT = {
  measure: img(`${GATE}/measure-390.png`, { w: 360, cap: 2.2, q: 12 }),
  flowResult: img(`${GATE}/flow-06-result-390.png`, { w: 360, cap: 2.2, q: 12 }),
  result: img(`${GATE}/result-390.png`, { w: 360, cap: 2.2, q: 12 }),
};
// Real station photos (photos/station, Sat) and the chamber blueprint's top view, prepared by figma/station-photos.sh (sips + cwebp)
const PHOTO = 'figma/art/station';
const STATION_PHOTO = {
  ledBox: img(`${PHOTO}/slide-led-box.webp`, BIG(768)),
  blueCup: img(`${PHOTO}/slide-blue-cup.webp`, BIG(768)),
  topView: img(`${PHOTO}/chamber-top-view.webp`, BIG(1060)),
};
// Art captured from the live site by capture-art.mjs (figma/art/*.png)
const ART = {
  pill: img('figma/art/binary-pill.png', BIG(1000)),
  siteHero: img('figma/art/site-hero.png', BIG(1100)),
  siteVerdicts: img('figma/art/site-verdicts.png', BIG(900)),
  siteMoney: img('figma/art/site-payments.png', BIG(900)),
};

// ───────────────────────────── slides ─────────────────────────────
const slides = [];
const S = (name, els, notes, bg = C.paper) => slides.push({ id: `s${String(slides.length + 1).padStart(2, '0')}`, name, bg, els, notes });

// 1 · title
S('Title', [
  ...logo(X, 64, 1.1),
  eyebrow(X, 250, 'Cal Hacks 13.0 · Idea to Demo · Figma'),
  head(X, 300, 870, [{ s: 'The box measures.\n' }, { s: 'Pill explains.', italic: true }], 140, { lh: 96 }),
  body(X, 620, 780, 'A box of hobby parts around an Arduino UNO Q. One whole tablet in a small cup, a 60-second quick run, one of three answers. In a clinic, that answer decides whether the supplier gets paid.', { size: 32 }),
  ...chipRow(X, 860, ['PASS', 'NEEDS LAB', 'UNABLE TO VERIFY'].map((v) => vchip(v))),
  image(1000, 170, 800, 657, ART.pill, { radius: 40, fit: 'cover' }),
  mono(1000, 850, 800, 'Art · the site\u2019s binary pill (pill.js), captured from pill-site.vercel.app'),
], 'Pill is a box of hobby parts around an Arduino UNO Q. One whole tablet in a small cup, a sixty-second quick run, two light sensors. It says three things only: PASS, NEEDS LAB, UNABLE TO VERIFY.');

// 2 · the moment
const MX = X + 50, MY = 390; // chart origin; coordinates below are the pitch deck's 960×560 chart
S('The moment', [
  ...chrome('The moment · delivery d-1042 · replay TM-02'),
  head(X, 150, 1500, [{ s: 'Same label. ' }, { s: 'Chalk inside.', italic: true }], 104),
  body(X, 280, 1300, 'Clinic app replay of its simulated two-channel design. The bottle says vitamin B2. The blue line drops into the reference band, so a one-sensor tester would call it a pass. The 90° channel never moves.', { size: 28 }),
  card(X, 400, 1060, 560),
  rect(MX + 80, MY + 170, 840, 76, { fill: C.skyTint }),
  line([[MX + 80, MY + 170], [MX + 920, MY + 170]], C.sky, { w: 2, head: false, dash: [8, 8] }),
  line([[MX + 80, MY + 246], [MX + 920, MY + 246]], C.sky, { w: 2, head: false, dash: [8, 8] }),
  line([[MX + 80, MY + 60], [MX + 80, MY + 490], [MX + 920, MY + 490]], C.ink, { w: 2, head: false }),
  curve(MX, MY, 960, 560, 'M 80 490 C 200 420 300 300 420 250 C 540 200 700 222 920 220', C.sky, { w: 7 }),
  curve(MX, MY, 960, 560, 'M 80 486 C 300 485 600 484 920 483', C.mint, { w: 7 }),
  mono(MX + 520, MY + 132, 400, 'reference band 0.36–0.47', { size: 19, color: C.ink, align: 'right' }),
  text(MX + 560, MY + 262, 380, 'blue inline: in the band', { size: 24, weight: 600 }),
  text(MX + 560, MY + 420, 380, '90° channel: flat', { size: 24, weight: 600 }),
  mono(MX + 80, MY + 504, 200, '0 s'), mono(MX + 720, MY + 504, 200, '180 s', { align: 'right' }),
  mono(X, 972, 1060, 'Illustration · the shape of replay TM-02, redrawn; not live sensor data.', { size: 16 }),
  card(1240, 400, 560, 560, { fill: C.amberTint, stroke: 'rgba(224,154,58,0.40)' }),
  eyebrow(1280, 440, 'Rule N2 · inline moved, 90° did not rise', 480, { color: C.ink2, size: 15, ls: 6 }),
  head(1280, 488, 480, 'NEEDS LAB', 96),
  body(1280, 608, 480, 'A one-sensor tester would have passed it.', { size: 26, color: C.ink }),
  rect(1280, 708, 480, 2, { fill: C.amber }),
  eyebrow(1280, 736, 'Policy P2 · hold, draft the lab referral', 480, { color: C.ink2, size: 17, ls: 10 }),
  text(1280, 780, 480, '$480.00 held', { font: 'mono', size: 52, weight: 500, lh: 110 }),
  ...chip(1280, 876, 'SANDBOX · REPLAY', C.greyTint),
], 'This is the clinic app replaying its simulated two-channel design. The bottle says vitamin B2; inside is chalk. The blue line drops right into the reference band, so a one-sensor tester would call that a pass, but the 90-degree channel never moves. Pill says NEEDS LAB and the supplier\'s four hundred and eighty dollars stays held, lab referral drafted. Sandbox money; this is a replay, and we say so.');

// 3 · one in ten
const stats = [
  ['116,000', 'extra malaria deaths a year in sub-Saharan Africa, modelled central estimate, from substandard and falsified antimalarials (range 64,000–158,000)', 'LSHTM model, cited by WHO, 2017', C.amber],
  ['>300', "children's deaths linked to contaminated cough syrups in three countries, 2022–23, most under five", 'WHO, Jan 2023', C.amber],
  ['$30.5B', "spent each year on substandard and falsified medical products, by WHO's estimate", 'WHO fact sheet, 2024', C.sky],
];
S('The problem', [
  ...chrome('The problem'),
  head(X, 150, 1000, 'One in ten.', 150),
  body(X, 330, 1400, 'WHO estimates 1 in 10 medical products in low- and middle-income countries is substandard or falsified. The lab instrument that catches one costs $20,000 to $100,000.', { size: 30 }),
  ...Array.from({ length: 10 }, (_, i) => i === 6).map((bad, i) => capsule(X + 43 + i * 166, 466, 100, 230, 0.5, bad
    ? { fill: C.amber, track: C.amberTint, stroke: C.amber, strokeW: 4 }
    : { fill: '#D9DDE1', track: C.surface, stroke: 'rgba(22,24,27,0.22)', strokeW: 3 })),
  mono(X + 43, 716, 1600, 'Illustration · one tablet in ten. WHO, 2017: substandard and falsified products counted together.'),
  ...stats.flatMap(([big, what, src, c], i) => {
    const x = X + i * 580;
    return [rect(x, 780, 56, 6, { fill: c, radius: 3 }), text(x, 802, 520, big, { font: 'serif', size: 64, lh: 100 }),
      text(x, 876, 520, what, { size: 18, color: C.ink2, lh: 140 }), mono(x, 960, 520, src, { size: 15 })];
  }),
], 'WHO estimates 1 in 10 medical products in low- and middle-income countries is substandard or falsified. A new lab dissolution tester costs twenty to a hundred thousand dollars, and lab results take seven to ten business days. A clinic pharmacist has neither; what they have is an invoice to pay this afternoon.');

// 4 · the station: Arduino UNO Q (pitch/DEVPOST-FINAL.md "How we built it · Hardware")
const stationFacts = [
  ['Arduino UNO Q · 3.3 V · 12-bit', 'Two photoresistors in 10 k\u03a9 dividers from the 3V3 pin: A0 across the cup, A1 at 90\u00b0 to the beam.', C.ink],
  ['A dark reading every second', 'All LEDs off, both sensors read. Room light cancels out of the signal instead of leaking into it.', C.grey],
  ['Blue, white, red in turn', 'Each LED lights alone and both sensors read again: light that gets through, light that scatters sideways.', C.sky],
  ['One CSV line a second', 'ms, dark, blue, white, red for each sensor, at 115200 baud. The firmware decides nothing.', C.mint],
];
S('The station', [
  ...chrome('The station'),
  head(X, 150, 760, 'Lot numbers can be copied. Dissolution cannot.', 84),
  body(X, 370, 740, 'A recall lookup trusts the label. Pill measures the tablet itself: one tablet in a cup of water inside a dark chamber, two light sensors watching it dissolve.', { size: 25 }),
  ...stationFacts.flatMap(([k, d, dot], i) => {
    const y = 540 + i * 108;
    return [{ t: 'ellipse', x: X, y: y + 9, w: 18, h: 18, fill: dot },
      text(X + 36, y, 700, k, { size: 25, weight: 600, lh: 130 }), text(X + 36, y + 38, 700, d, { size: 18, color: C.ink2, lh: 140 })];
  }),
  ...[[STATION_PHOTO.ledBox, 'Photo · the purple 3D-printed chamber with a clear cup of water; the side box holds white, blue and red LEDs; a sensor holder on the chamber wall; the UNO Q at left.'],
    [STATION_PHOTO.blueCup, 'Photo · from above: blue light inside the cup, the LED box below it, the UNO Q at lower left.']].flatMap(([id, cap], i) => {
    const x = 920 + i * 450;
    return [image(x, 150, 430, 352, id, { radius: 20, fit: 'cover' }), mono(x, 516, 430, cap, { size: 16 })];
  }),
  card(920, 612, 474, 388, { fill: C.surface, radius: 20 }),
  image(924, 616, 466, 380, STATION_PHOTO.topView, { radius: 16, fit: 'contain' }),
  mono(1420, 624, 380, 'Drawing · the chamber design, top view (pillgate/diagrams): the LED pod on one side, one photoresistor straight across the cup, one at 90\u00b0 to the beam.', { size: 16 }),
], 'The station is an Arduino UNO Q, a 3.3-volt board with a 12-bit ADC. These are photos of it from Saturday: a purple 3D-printed chamber holding a clear cup of water, a side box with white, blue and red LEDs, and the UNO Q next to it. The drawing shows where the two photoresistors sit, one in line with the beam and one at ninety degrees. Once a second it turns every LED off and reads both, the dark reading that cancels room light, then lights blue, white and red in turn and reads again. It sends one CSV line a second. The firmware decides nothing; the laptop does the maths.');

// 5 · the station app: Pill Gate's guided check and its three answers (station-app wording)
const gatePhases = [
  ['Prepare', 'checks', 'Lid closed, the LED reaches the sensor.', C.grey, C.greyTint],
  ['Clean water', '10 s', 'The blank must hold steady for 10\u00a0s.', C.sky, C.skyTint],
  ['Tablet in', 'lid opens', 'The lid opening on both sensors marks the start.', C.violet, C.violetTint],
  ['Dissolving', '60 s', 'Absorbance and cloudiness curves, live.', C.skyInk, C.skyTint],
  ['Result', 'auto', 'Compared with the reference profile.', C.mint, C.mintTint],
];
const gateAnswers = [
  ['Passed the screen', C.mintTint, C.mint, 'Time-to-80\u00a0% and final colour inside the spread of the reference runs.'],
  ['Needs lab testing', C.amberTint, C.amber, 'Outside it: slower, weaker, cloudier or clearer than the reference.'],
  ['Unable to verify', C.greyTint, C.grey, 'No reference for this product, lid open too long, a noisy blank, or the curve never settled.'],
];
const GCOL = (W - 2 * X) / gatePhases.length;
S('The station app', [
  ...chrome('The station app · Pill Gate'),
  head(X, 128, 900, 'The station app.', 72),
  body(X + 960, 132, 720, 'Pill Gate runs on the laptop next to the box (Python, FastAPI). It guides the check and compares the run with a reference profile built from three or more runs of a known-good tablet.', { size: 19, lh: 140 }),
  rect(X + 12, 297, W - 2 * X - GCOL + 12, 2, { fill: C.line2 }),
  ...gatePhases.flatMap(([name, time, desc, dot, tint], i) => {
    const x = Math.round(X + i * GCOL);
    return [
      { t: 'ellipse', x, y: 286, w: 24, h: 24, fill: dot, stroke: C.surface, strokeW: 4 },
      mono(x + 40, 287, 200, String(i + 1).padStart(2, '0'), { size: 17, weight: 500, ls: 10, lh: 130 }),
      text(x, 334, 300, name, { size: 27, weight: 600, lh: 130 }),
      ...chip(x, 378, time, tint, { size: 16 }),
      body(x, 428, 300, desc, { size: 18, lh: 140 }),
    ];
  }),
  ...[[GATE_SHOT.measure, 'Measure · the phase rail'], [GATE_SHOT.flowResult, 'Guided flow · step 6'], [GATE_SHOT.result, 'Result · the answer']].flatMap(([id, label], i) => {
    const x = X + i * 290;
    return [...phone(x, 520, 260, id, 420), mono(x, 950, 260, label, { align: 'center', size: 16, color: C.ink2 })];
  }),
  eyebrow(1040, 528, 'Three answers, written this way in the station app', 760, { size: 16 }),
  ...gateAnswers.flatMap(([word, tint, dot, d], i) => {
    const y = 580 + i * 130;
    return [...chip(1040, y, word, tint, { dot, size: 20 }), text(1040, y + 56, 760, d, { size: 20, color: C.ink2, lh: 140 })];
  }),
], 'The station has its own app, Pill Gate, on the laptop beside the box. Prepare checks the lid and the light path, ten seconds of clean water make the blank, the lid opening marks the tablet going in, sixty seconds of dissolving, then the result. It compares the run with a reference profile from three or more runs of a known-good tablet, and it says one of three things: Passed the screen, Needs lab testing, or Unable to verify.');

// 6 · how a run works
const fills = [[0, 'blank', '0:00 · dark, then 10 s of clean water. Lid open? No run.'], [0.22, 'dissolving', 'One whole tablet in; stirred by hand.'], [0.53, 'dissolving', 'The light through the cup changes as it dissolves.'], [0.86, 'settling', 'The curve starts to flatten.'], [1, 'done', '1:00 · compared with the reference.']];
S('How a run works', [
  ...chrome('How a run works'),
  head(X, 150, 1500, '60 seconds, start to answer.', 96),
  body(X, 270, 1500, 'Quick mode stops 60\u00a0s after the tablet goes in; full mode runs 2\u201310\u00a0min until the curve is flat. The station app compares the run with a reference profile (three or more good runs); the clinic app draws it as a pill filling to its reference plateau.', { size: 26 }),
  ...fills.flatMap(([lvl, word, d], i) => {
    const cx = X + i * 336, px = cx + 93, done = lvl === 1;
    return [capsule(px, 360, 150, 370, lvl, { fill: done ? C.mint : C.sky, stroke: done ? C.mint : C.sky, strokeW: 5 }),
      ...(i < fills.length - 1 ? [line([[px + 172, 545], [px + 314, 545]], C.line2, { w: 3 })] : []),
      text(cx, 752, 336, `${Math.round(lvl * 100)}%`, { font: 'serif', size: 56, align: 'center', lh: 100 }),
      mono(cx, 816, 336, word, { align: 'center' }),
      text(cx + 18, 852, 300, d, { size: 20, color: C.ink2, lh: 140, align: 'center' })];
  }),
  mono(X, 966, 1680, 'Illustration · example levels; the app draws them live from the sensor stream.', { size: 16 }),
], 'One whole tablet in a small cup, stirred by hand. Quick mode is sixty seconds after the tablet goes in; full mode runs two to ten minutes until the curve is flat. The run is compared with a reference, and the answer is one of three. A model explains the result in plain English but never sets it.');

// 7 · three answers
const answers = [
  ['PASS', APP.pass, 'Plateau in the reference band and the 90° channel rose with it (P1).'],
  ['NEEDS LAB', APP.needsLab, 'Light dropped with no rise at 90°, no plateau, or a plateau outside the band (N1–N3).'],
  ['UNABLE TO VERIFY', APP.unable, 'No reference for this drug, a fault, or too little data (U1–U3).'],
];
S('Three answers', [
  ...chrome('Three answers'),
  head(X, 140, 1500, [{ s: 'Three answers. ' }, { s: 'Never a guess.', italic: true }], 84),
  body(X, 240, 1500, 'Seven rules, checked in order. A model writes the plain-English \u201cwhy\u201d; it never sets the verdict.', { size: 24 }),
  ...answers.flatMap(([word, id, why], i) => {
    const x = X + i * 570;
    return [...chip(x, 304, word, VERDICT[word][0], { dot: VERDICT[word][1], size: 22 }),
      text(x, 366, 500, why, { size: 21, color: C.ink2, lh: 140 }),
      ...phone(x, 452, 320, id, 512)];
  }),
], 'It says three things only: PASS, NEEDS LAB, UNABLE TO VERIFY. Never a fourth. In the clinic app PASS means this tablet\'s curve matched the reference band; it does not mean right drug, right dose or contaminant-free.');

// 8 · how the money moves, and who decides (pitch/FLOW-SPEC.md: the tree, the Coinbase money column, the x402 lane, the models row)
// Arrows are ink; a dashed line means "not yet run"; red only on Hold.
const RED_TINT = 'rgba(224,72,72,0.16)';
const arrow = (pts, o = {}) => line(pts, C.ink, { w: 2, headLen: 10, ...o });
/** Outline-only box drawn as a dashed path (rect has no dash): "not yet run". */
const dashedBox = (x, y, w, h, stroke = C.ink2) => [rect(x, y, w, h, { fill: C.surface, radius: 0 }), curve(x, y, w, h, `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} L 0 0`, stroke, { w: 2, dash: [8, 7] })];
const ANSWERS = [['Passed the screen', C.mintTint], ['Needs lab testing', C.amberTint], ['Unable to verify', C.greyTint]];
const OUTPUTS = [['Release · passed + no recall + within cap + tap', C.mintTint], ['Hold · needs lab; lab referral drafted', RED_TINT], ['Escalate · unable to verify \u2192 a person; nothing moves', C.greyTint]];
const WALLETS = ['pill-clinic', 'pill-escrow', 'pill-supplier'];
const LANE = [
  ['Buyer agent · another clinic, or an agent with no local reference', C.surface],
  ['POST /verify with a curve', C.surface],
  ['402 Payment Required · 0.05 USDC (TESTNET); the price travels in the 402', C.violetTint],
  ['Buyer reads the price, checks its 1 USDC / 24 h cap, signs', C.surface],
  ['Facilitator verifies the signature', C.surface],
  ['200 + verdict JSON · pending a CDP key / 0.05 test USDC', null],
];
const MODELS = [
  ['Claude', 'Station: reads the bottle label + imprint, writes the report, answers Ask, behind the guardrail. Clinic: the two-sentence \u201cwhy\u201d; the escrow clerk (returns the ceiling computed in code, or escalate).', 'Sets a verdict; moves money'],
  ['Gemini', 'Clinic: reads the bottle label into editable fields (unreadable \u2192 null); runs the agentic checker (label, up to three cup frames, code tools for the recall lookup).', 'Sets a verdict; invents a field'],
  ['Deterministic code', 'analysis.py and rules.ts (U1 U2 U3 N1 N2 N3 P1) set every verdict; the policy computes the ceiling; the clause filter drops any model sentence with a banned claim word (over half dropped \u2192 rule text).', 'Calls a model to decide'],
];
S('Money flow', [
  ...chrome('How the money moves', { footer: false }),
  head(X, 112, 1500, 'How the money moves, and who decides.', 56),
  ...[['Measure', X], ['Three answers', 480], ['The policy agent · pill/pay', 830], ['The money · Coinbase', 1360]].map(([t, x]) => eyebrow(x, 196, t, 470, { size: 15, ls: 10 })),
  // column 1: measure
  card(X, 228, 300, 64, { radius: 18 }), text(X + 24, 246, 252, 'One tablet', { size: 20, weight: 600, lh: 130 }),
  arrow([[270, 294], [270, 318]]),
  card(X, 322, 300, 150, { radius: 18 }), text(X + 24, 338, 252, 'Station · Arduino UNO Q', { size: 20, weight: 600, lh: 130 }),
  text(X + 24, 370, 252, 'Blue · white · red LEDs, 2 photoresistors, 1 CSV line/s. The firmware decides nothing.', { size: 16, color: C.ink2, lh: 140 }),
  arrow([[270, 474], [270, 498]]),
  card(X, 502, 300, 104, { radius: 18 }), text(X + 24, 518, 252, 'analysis.py', { font: 'mono', size: 20, weight: 600, lh: 130 }),
  text(X + 24, 550, 252, 'Deterministic: curve maths, quality gates.', { size: 16, color: C.ink2, lh: 140 }),
  // column 2: the fork
  ...ANSWERS.flatMap(([label, fill], i) => {
    const y = 240 + i * 96;
    return [rect(480, y, 290, 76, { fill, radius: 16 }), text(504, y + 24, 250, label, { size: 20, weight: 600, lh: 130 }),
      arrow([[422, 554], [450, 554], [450, y + 38], [476, y + 38]])];
  }),
  text(480, 528, 290, 'Three answers, never four. No model sets a verdict.', { size: 16, color: C.ink2, lh: 140 }),
  // column 3: the policy agent
  card(830, 228, 470, 196, { radius: 18 }),
  text(854, 246, 422, 'Six clauses P1\u2013P6, in code \u2192 a ceiling.', { size: 20, weight: 600, lh: 130 }),
  text(854, 280, 422, 'Claude may only return the ceiling or escalate.', { size: 17, color: C.ink2, lh: 140 }),
  mono(854, 330, 422, 'in: the verdict · recall lookup (openFDA) · bottle label (Gemini \u2192 editable fields; unreadable = null) · invoice amount vs cap · pharmacist\u2019s tap', { size: 14, color: C.ink2 }),
  arrow([[770, 278], [826, 278]]), arrow([[770, 374], [826, 374]]), arrow([[770, 470], [800, 470], [800, 400], [826, 400]]),
  arrow([[1065, 426], [1065, 448]]),
  ...OUTPUTS.flatMap(([label, fill], i) => {
    const y = 452 + i * 60;
    return [rect(830, y, 470, 50, { fill, radius: 25 }), text(852, y + 14, 430, label, { size: 16, weight: 500, lh: 130 })];
  }),
  // column 4: the money (CDP server wallets)
  ...WALLETS.flatMap((name, i) => {
    const y = 228 + i * 108;
    return [card(1360, y, 250, 64, { radius: 16 }), text(1380, y + 10, 210, name, { font: 'mono', size: 20, weight: 600, lh: 130 }),
      mono(1380, y + 38, 210, 'CDP server wallet', { size: 14 })];
  }),
  arrow([[1450, 294], [1450, 332]]), text(1462, 300, 170, 'hold · delivery logged', { size: 15, color: C.ink2, lh: 130 }),
  arrow([[1450, 402], [1450, 440]]), text(1462, 408, 170, 'release', { size: 15, color: C.ink2, lh: 130 }),
  arrow([[1612, 368], [1650, 368], [1650, 260], [1614, 260]]), text(1662, 300, 140, 'refund', { size: 15, color: C.ink2, lh: 130 }),
  arrow([[1302, 477], [1356, 477]]),
  ...dashedBox(1640, 404, 160, 104),
  text(1652, 414, 136, 'Capital One Nessie mirror, sandbox dollars (SANDBOX; not yet run)', { size: 14, color: C.ink, lh: 135 }),
  text(1360, 524, 440, 'USDC on Base Sepolia (TESTNET) · Coinbase CDP SDK server wallets', { size: 16, color: C.ink2, lh: 140 }),
  ...chip(1360, 578, 'ESCROW · MODE: SIMULATED UNTIL A CDP KEY', C.greyTint, { size: 14 }),
  // the second lane: selling a verdict over x402
  eyebrow(X, 640, 'Selling a verdict · Coinbase x402', 1200, { size: 15, ls: 10 }),
  ...LANE.flatMap(([label, fill], i) => {
    const x = X + i * 285;
    return [
      ...(fill ? [card(x, 666, 256, 96, { fill, radius: 16 })] : dashedBox(x, 666, 256, 96)),
      text(x + 12, 678, 232, label, { size: 16, weight: i === 2 ? 600 : 400, lh: 135 }),
      ...(i < LANE.length - 1 ? [arrow([[x + 258, 714], [x + 283, 714]], i === LANE.length - 2 ? { dash: [6, 5] } : {})] : []),
    ];
  }),
  text(X, 774, W - 2 * X, 'Real 402 today; the facilitator\u2019s verify step answered (insufficient_balance on our unfunded test wallet). @x402/express · @x402/evm · CDP SDK. Service modes cdp · public-facilitator · simulated, each named in every response.', { size: 15, color: C.ink2, lh: 140 }),
  // the models row
  mono(X, 830, 260, 'MODEL', { size: 14, ls: 10 }), mono(400, 830, 900, 'DOES', { size: 14, ls: 10 }), mono(1440, 830, 360, 'NEVER', { size: 14, ls: 10 }),
  ...MODELS.flatMap(([who, does, never], i) => {
    const y = 860 + i * 52;
    return [rect(X, y - 8, W - 2 * X, 1, { fill: C.line }),
      text(X, y, 260, who, { size: 17, weight: 600, lh: 130 }),
      text(400, y, 1010, does, { size: 15, color: C.ink2, lh: 140 }),
      text(1440, y, 360, never, { size: 15, color: C.ink, lh: 140 })];
  }),
], 'How the money moves, and who decides. One tablet goes into the station; deterministic code turns the curve into one of three answers. The policy agent runs six clauses in code to get a ceiling; Claude may only return that ceiling or escalate. Passed, no recall, within the cap and a pharmacist\u2019s tap releases the escrow to the supplier; Needs lab holds it and drafts a lab referral; Unable to verify escalates to a person. The money column is three Coinbase CDP server wallets, USDC on Base Sepolia, testnet, and escrow moves are simulated until we have a CDP key. Underneath, another clinic can buy a verdict over x402: the 402 is real today, the paid 200 is still pending. Claude and Gemini explain and read; code sets every verdict.');

// 9 · coinbase
const x402 = [['402', 'The server answers \u201cPayment Required\u201d: 0.05 USDC on Base Sepolia.'], ['sign', 'The buyer\u2019s wallet signs that exact payment; over its spend cap, it refuses.'], ['settle', 'PENDING · the facilitator settles it on Base Sepolia (needs 0.05 test USDC or a CDP key).'], ['200', 'PENDING · the server answers with the verdict and the rule id that fired.']];
const roles = [['Pay', 'Escrow \u2192 supplier in USDC, only after PASS and a pharmacist\u2019s tap.'], ['Buy', 'No local reference? Buy a verdict from another station over x402, capped per day.'], ['Earn', 'Every station can sell /verify to other clinics.']];
S('Coinbase', [
  rect(0, 0, W, H, { fill: C.violetTint }),
  ...chrome('Coinbase · x402 · payment agents'),
  head(X, 150, 1250, 'The verdict is the invoice.', 96),
  ...chipRow(X, 282, [['TESTNET · BASE SEPOLIA', 'rgba(122,92,255,0.16)', { dot: C.violet }], ['0.05 USDC PER VERDICT', C.surface, { stroke: C.line2 }]]),
  ...x402.flatMap(([k, d], i) => {
    const x = X + i * 320;
    return [card(x, 380, 270, 290, { stroke: 'rgba(122,92,255,0.30)', radius: 24 }), rect(x + 28, 408, 48, 6, { fill: C.violet, radius: 3 }),
      text(x + 28, 430, 214, k, { font: 'mono', size: 54, weight: 600, lh: 110 }), text(x + 28, 512, 214, d, { size: 19, color: C.ink2, lh: 140 }),
      ...(i < x402.length - 1 ? [line([[x + 278, 525], [x + 312, 525]], C.violet, { w: 3, headLen: 10 })] : [])];
  }),
  ...roles.flatMap(([k, d], i) => {
    const x = X + i * 430;
    return [rect(x, 726, 6, 150, { fill: C.violet, radius: 3 }), mono(x + 28, 726, 360, `0${i + 1}`, { size: 18, color: C.ink2 }),
      text(x + 28, 756, 360, k, { size: 30, weight: 600, lh: 120 }), text(x + 28, 800, 370, d, { size: 21, color: C.ink2, lh: 140 })];
  }),
  ...phone(1450, 150, 350, APP.verify, 800),
  mono(1450, 962, 350, 'app · /verify over x402', { align: 'center', size: 16 }),
], 'Other clinics can buy a verdict for five cents over x402. The server really answers 402 and the facilitator checks the signed payment; settle and the paid 200 are still pending, waiting on 0.05 test USDC or a CDP key. Testnet USDC on Base Sepolia; nothing here is real money.', '#FFFFFF');

// 10 · app screens, 6 × 2
const grid = [['welcome', APP.welcome], ['bottle', APP.bottle], ['place', APP.place], ['run', APP.run], ['PASS', APP.pass], ['NEEDS LAB', APP.needsLab],
  ['held · P2', APP.held], ['released', APP.released], ['/verify · x402', APP.verify], ['home', APP.home], ['medicines', APP.medicines], ['ask', APP.ask]];
S('App screens', [
  ...chrome('The app', { footer: false }),
  head(X, 128, 1100, 'The clinic app: on a laptop and a phone.', 64),
  body(X + 1130, 128, 550, `25 routes in React. All ${appShotCount} app screenshots go into the Design file, one frame each, labelled with their route. These twelve are the newest pass.`, { size: 19, lh: 140 }),
  ...grid.flatMap(([label, id], i) => {
    const x = X + (i % 6) * 285, y = 236 + Math.floor(i / 6) * 410;
    return [...phone(x, y, 254, id, 352), mono(x, y + 362, 254, label, { align: 'center', size: 16, color: C.ink2 })];
  }),
], 'The clinic app is one web app on a laptop and on any phone. These are the newest build pass; the Design file has every screenshot, grouped by pass and linked to its route.');

// 11 · six phases: the clinic app's run phases (pill/pay/src/station.ts drives its simulated station), one column per phase
const phases = [
  ['Lights off', '3 s', 'LEDs off. The box must read dark; a light leak means the lid is open, and the run stops.', C.dark, C.greyTint, 'dark'],
  ['Clear water', '10 s', 'Plain water. The blank must hold steady (CV under 2\u00a0%) or it retries, up to 3\u00a0times.', C.sky, C.skyTint, 'water'],
  ['Drop the tablet', '≤ 30 s', 'It waits for the inline reading to fall 6\u00a0%. After 30\u00a0s the screen prompts.', C.violet, C.violetTint, 'drop'],
  ['Dissolving', '1–2 min', 'The pill fills, the curve falls, the 90° channel rises. Flat at 90° while blue falls: the amber moment.', C.skyInk, C.skyTint, 'dissolving'],
  ['Settling', '20 s window', 'Flat for 20\u00a0s (|dA/dt|\u00a0<\u00a0ε) means plateau. No plateau by 180\u00a0s: timeout.', C.grey, C.greyTint, 'settling'],
  ['Verdict', '7 rules', 'Seven rules, in order. The rule that fired is printed with the word.', C.mint, C.mintTint, 'verdict'],
];
const PCOL = (W - 2 * X) / phases.length;
S('Six phases', [
  ...chrome('The clinic app, phase by phase'),
  head(X, 128, 1000, 'Six phases, one run.', 72),
  body(X + 1060, 132, 620, 'The clinic app\u2019s run, live against its simulated station. Each phase has its own time, its own look and its own check; a failed check stops the run and says why.', { size: 19, lh: 140 }),
  rect(X + 12, 297, W - 2 * X - PCOL + 12, 2, { fill: C.line2 }),
  ...phases.flatMap(([name, time, desc, dot, tint, key], i) => {
    const x = Math.round(X + i * PCOL);
    return [
      { t: 'ellipse', x, y: 286, w: 24, h: 24, fill: dot, stroke: C.surface, strokeW: 4 },
      mono(x + 40, 287, 200, String(i + 1).padStart(2, '0'), { size: 17, weight: 500, ls: 10, lh: 130 }),
      text(x, 334, 256, name, { size: 27, weight: 600, lh: 130 }),
      ...chip(x, 378, time, tint, { size: 16 }),
      body(x, 428, 256, desc, { size: 17, lh: 140 }),
      ...phone(x, 540, 230, PHASE_SHOT[key], 410),
    ];
  }),
], 'The clinic app shows a run as six phases, played here against its simulated station. Lights off for three seconds: the box must be dark, or the lid is open and nothing runs. Ten seconds of clear water as the blank; it must be steady. Drop the tablet; it waits for the reading to fall six percent. Dissolving: the pill fills and the 90-degree channel should rise with it. Settling: twenty flat seconds is a plateau. Then the seven rules give the word.');

// 12 · the Gemini checker and the follower
const checkSteps = [['Read the label', 'gemini vision'], ['Look at the cup', 'gemini vision'], ['Check for a recall', 'openFDA'], ['Check expiry, drug and lot', 'code'], ['Compare with the sensor', 'code'], ['Say it in plain words', 'gemini · filtered']];
S('Gemini checker', [
  ...chrome('Gemini checks the sensor'),
  head(X, 128, 680, 'Gemini checks what the sensor says.', 72),
  body(X, 300, 640, 'After the run, Gemini reads the label, looks at the cup and checks for a recall, then compares that with the sensor. Six steps, each logged with its own time.', { size: 21, lh: 145 }),
  ...checkSteps.flatMap(([name, tool], i) => {
    const y = 470 + i * 56;
    return [
      { t: 'ellipse', x: X, y, w: 36, h: 36, fill: C.skyTint },
      mono(X, y + 7, 36, String(i + 1), { size: 17, weight: 600, color: C.ink, align: 'center', lh: 130 }),
      text(X + 54, y + 3, 400, name, { size: 21, weight: 600, lh: 140 }),
      mono(X + 440, y + 8, 200, tool, { size: 16, align: 'right', lh: 130 }),
    ];
  }),
  card(X, 830, 640, 120, { fill: C.mintTint, stroke: 'rgba(95,211,154,0.45)' }),
  text(X + 28, 852, 584, 'The sensor decides. The checker explains and never changes the word. A pharmacist or doctor decides.', { size: 20, color: C.ink, lh: 140 }),
  ...[[GEMINI_SHOT.steps, 'Checker · the step log'], [GEMINI_SHOT.report, 'Checker · the report'], [GEMINI_SHOT.follower, 'Follower · on every screen']].flatMap(([id, label], i) => {
    const x = 820 + i * 330;
    return [...phone(x, 196, 300, id, 640), mono(x, 852, 300, label, { align: 'center', size: 16, color: C.ink2 })];
  }),
], 'After the run, a Gemini agent checks what the sensor says: it reads the label, looks at photos of the cup, checks openFDA for a recall, cross-checks expiry, drug and lot, and compares what the camera saw with the sensor numbers. Every step is logged with its own time. The verdict word comes from the sensor and is never changed. The follower is the same Gemini, docked on every screen, answering questions about what is on it.');

// 13 · website
S('Website', [
  ...chrome('The website'),
  head(X, 150, 1000, 'pill-site.vercel.app', 80),
  body(X, 256, 1600, 'Built code-first (Vite + anime.js) after a 16-persona panel scored a plain, honest page 8.0 against a copied storytelling site at 3.7. Words stay ink; colour lives in backgrounds and lines.', { size: 25 }),
  ...browserShot(X, 360, 860, ART.siteHero, 512),
  mono(X, 926, 860, 'Hero · the binary pill, drawn in characters by pill.js'),
  ...browserShot(1010, 360, 790, ART.siteVerdicts, 222, 'cover'),
  mono(1010, 636, 790, 'Fig 3 · three answers, the same screen as the app'),
  ...browserShot(1010, 676, 790, ART.siteMoney, 196, 'cover'),
  mono(1010, 926, 790, 'Payments · the verdict is the invoice'),
], 'The website came first and set the tokens the app inherited. A 16-persona panel picked a plain, honest page over a copied storytelling site. All three crops are the live site today, captured headless.');

// 14 · workflow
const flow = [
  ['Ideation', ['AI persona panels', 'Web research'], ['FigJam board']],
  ['Prototyping', ['binary-pill.html', 'Phone mock (Vite)'], ['Figma Make prompt']],
  ['Handoff', ['CSS :root, by hand'], ['Styles + variables', 'Composio \u2192 CSS']],
  ['Code generation', ['Claude Code + 3 builders'], ['Pill \u2192 Figma plugin']],
];
// numbers on the slides come from STAGE-LOG.md; the short phrases are a summary of the same sections
const minShort = (s) => (s.minutes.match(/≈\d+/) || ['?'])[0] + ' min';
const rateShort = (s) => (s.rating.match(/\d\/5/) || ['?'])[0];
const pending = (s) => /\[fill after running\]/.test(s.minutes + s.rating);
S('Workflow', [
  ...chrome('Workflow · idea to demo'),
  head(X, 150, 1500, 'Code first, then Figma from the code.', 88),
  line([[X + 26, 376], [X + 1660, 376]], C.sky, { w: 3 }),
  mono(X + 1500, 330, 160, 'demo', { align: 'right', color: C.ink2 }),
  ...flow.flatMap(([name, code, fig], i) => {
    const x = X + i * 440, s = stages[i];
    const figY = 544 + code.length * 50 + 40, endY = figY + 30 + fig.length * 50 + 14;
    return [{ t: 'ellipse', x, y: 350, w: 52, h: 52, fill: i === 3 ? C.sky : C.surface, stroke: C.sky, strokeW: 4 },
      mono(x, 424, 300, `0${i + 1}`, { size: 18, color: C.ink2 }),
      text(x, 452, 400, name, { font: 'serif', size: 48, lh: 100 }),
      eyebrow(x, 518, 'Code', 300, { size: 15 }), ...code.flatMap((c, j) => chip(x, 544 + j * 50, c, C.surface, { size: 17, stroke: C.line2 })),
      eyebrow(x, figY, 'Figma', 300, { size: 15 }), ...fig.flatMap((c, j) => chip(x, figY + 30 + j * 50, c, C.violetTint, { size: 17, dot: C.violet })),
      mono(x, endY, 400, `${minShort(s)} · ${rateShort(s)}`, { size: 18, color: C.ink }),
      ...(pending(s) ? chip(x, endY + 32, 'FIGMA STEP PENDING', C.greyTint, { size: 15 }) : [])];
  }),
  text(X, 958, 1680, 'Honest order: no Figma was used Friday or Saturday morning. The Figma files are generated from the repo, and the log says so.', { size: 22, color: C.ink2, lh: 140 }),
], 'We are a code-first team. Ideation and prototyping happened in markdown, AI panels and HTML. Figma enters as the place the repo is published to: slides, screens, tokens and the ideation board.');

// 15 · design from code
const node = (x, y, w, h, k, d, o = {}) => [card(x, y, w, h, { radius: 22, ...o }), text(x + 24, y + 22, w - 48, k, { font: 'mono', size: 21, weight: 600, lh: 130 }), text(x + 24, y + 58, w - 48, d, { size: 17, color: C.ink2, lh: 140 })];
const fan = [['Slides', 'deck + speaker notes'], ['Design', 'pages + styles'], ['FigJam', 'the ideation board']];
S('Design from code', [
  ...chrome('The Figma step'),
  head(X, 150, 1500, [{ s: 'This deck was ' }, { s: 'generated from the repo.', italic: true }], 88),
  ...node(X, 395, 230, 150, 'repo', 'screenshots · CSS :root · debate JSON · stage log'),
  ...node(X + 290, 395, 250, 150, 'build-deck.mjs', 'Node, no npm deps; ffmpeg for images'),
  ...node(X + 600, 395, 230, 150, 'deck.json', 'slides, pages and board in one file'),
  ...node(X + 890, 395, 250, 150, 'Pill \u2192 Figma', 'one-file plugin that draws deck.json', { fill: C.violetTint, stroke: 'rgba(122,92,255,0.35)' }),
  line([[X + 234, 470], [X + 284, 470]], C.sky), line([[X + 544, 470], [X + 594, 470]], C.sky), line([[X + 834, 470], [X + 884, 470]], C.sky),
  ...fan.flatMap(([k, d], i) => {
    const y = 318 + i * 110;
    return [card(1330, y, 220, 84, { radius: 18 }), text(1352, y + 12, 180, k, { size: 24, weight: 600, lh: 120 }), mono(1352, y + 48, 190, d, { size: 14, color: C.ink2 }),
      line([[X + 1144, 470], [1324, y + 42]], C.violet, { w: 2, headLen: 10 }), line([[1554, y + 42], [1594, 470]], C.line2, { w: 2, headLen: 10 })];
  }),
  ...node(1600, 395, 200, 150, 'Composio', 'comments, thumbnails, tokens'),
  ...node(1600, 640, 200, 110, 'CSS', 'tokens-from-figma.mjs'),
  line([[1700, 549], [1700, 634]], C.mint),
  line([[1594, 695], [X + 115, 695], [X + 115, 551]], C.mint, { dash: [10, 8] }),
  mono(X + 160, 708, 1300, 'the loop: Figma styles and variables \u2192 Composio \u2192 CSS back in the repo', { color: C.ink2 }),
  text(X, 790, 1680, 'Recipe for code-first teams: keep the repo as the source of truth, emit one JSON, let a plugin draw it. One run gives designers editable layers, every screen, the tokens as styles, and a board of how you decided.', { size: 27, lh: 145 }),
  text(X, 912, 1680, 'Why a plugin: the Figma REST API and our Composio connector can read, comment and set variables, but cannot create layers or slides. The Plugin API can.', { size: 21, color: C.ink2, lh: 145 }),
], 'The REST API cannot draw, so the repo emits deck.json and a one-file plugin draws it in Slides, Design or FigJam. Composio closes the loop: comments, dev resources back to the code, thumbnails, and tokens back to CSS. Nobody has run it in real Figma yet; that step is marked pending.');

// 16 · stage log table
const stageShort = [
  ['16 AI personas per panel, reference study; FigJam board generated after', 'One model played all 16: agreement inflated (SD 0)', 'PLAN.md decisions, scope, site outline'],
  ['binary-pill.html, phone mock in the site\u2019s JS; Figma Make prompt written', 'Nobody could click it without a code editor', 'APP-PLAN\u2019s 12 screens, the pill fill'],
  ['CSS :root copied site \u2192 app; Figma styles + variables; Composio \u2192 CSS', `${drift.identical} of ${siteVars.length} tokens arrived identical; no record of intent`, 'App :root, Tokens page, tokens-from-figma.mjs'],
  ['Claude Code + 3 parallel builders; Pill \u2192 Figma plugin', 'P6 hold rule bug; double deploy; REST API can\u2019t draw', 'App, payment service, this deck'],
];
const COLS = [[0, 'Stage', 250], [260, 'Tools', 470], [760, 'Minutes', 150], [920, 'Rating', 130], [1060, 'What broke', 330], [1410, 'Into the project', 270]];
S('Stage log', [
  ...chrome('Stage log'),
  head(X, 150, 1500, 'Four stages, timed from git.', 84),
  ...COLS.map(([x, h, w]) => eyebrow(X + x, 290, h, w, { size: 18 })),
  ...stages.flatMap((s, i) => {
    const y = 330 + i * 150, [tools, broke, into] = stageShort[i];
    return [rect(X, y, W - 2 * X, 2, { fill: C.line }),
      text(X, y + 24, 250, s.name, { font: 'serif', size: 40, lh: 105 }),
      text(X + 260, y + 24, 470, tools, { size: 21, lh: 135 }),
      mono(X + 760, y + 26, 150, minShort(s), { size: 21, color: C.ink }),
      mono(X + 920, y + 26, 130, rateShort(s), { size: 22, weight: 600, color: C.ink }),
      ...(pending(s) ? chip(X + 920, y + 66, 'PENDING', C.greyTint, { size: 14 }) : []),
      text(X + 1060, y + 24, 330, broke, { size: 21, color: C.ink2, lh: 135 }),
      text(X + 1410, y + 24, 270, into, { size: 21, color: C.ink2, lh: 135 })];
  }),
  rect(X, 930, W - 2 * X, 2, { fill: C.line }),
  mono(X, 954, 1680, 'PENDING = the Figma step is written but not yet run; its minutes and rating stay blank in the log, not estimated.', { size: 17 }),
], 'Four stages, timed from git commit times. Steps not yet run in real Figma say pending; we do not estimate them. The full log, with the Figma Make prompt and a ten-minute reproduce box, is STAGE-LOG.md.');

// 17 · what broke
const brokeCards = [
  ['The P6 hold rule', 'The scaffold held money only when the recall lookup was unreachable, so a delivery with no bottle attached could be proposed for release.', 'Caught by a builder\u2019s end-to-end test.'],
  ['A double deploy', 'A `tail -6` cut off Vercel\u2019s output, the deploy looked unfinished and was re-run: two identical production deploys.', 'Read the whole log before re-running.'],
  ['The REST API can\u2019t draw', 'The Figma REST API and our Composio connector read, comment and set variables. Neither can create a layer or a slide.', 'So the repo emits deck.json and a plugin draws it.'],
  [`${drift.identical} of ${siteVars.length} tokens survived the hand copy`, `Site \u2192 app by hand: ${drift.identical} identical, ${drift.changed.length} changed value, ${drift.missing.length} renamed or dropped. Nothing recorded which changes were meant.`, 'Tokens now go to Figma as variables and back as CSS.'],
];
S('What broke', [
  ...chrome('What broke'),
  head(X, 150, 1500, [{ s: 'What broke, ' }, { s: 'and what it changed.', italic: true }], 92),
  ...brokeCards.flatMap(([k, d, f], i) => {
    const x = X + (i % 2) * 860, y = 300 + Math.floor(i / 2) * 340;
    return [card(x, y, 820, 310, { radius: 24 }), rect(x + 36, y + 36, 56, 6, { fill: C.amber, radius: 3 }),
      text(x + 36, y + 64, 748, k, { size: 32, weight: 600, lh: 125 }), text(x + 36, y + 118, 748, d, { size: 23, color: C.ink2, lh: 145 }),
      rect(x + 36, y + 236, 748, 2, { fill: C.line }), mono(x + 36, y + 254, 748, f, { size: 18, color: C.ink })];
  }),
], 'What broke, honestly. A rule bug the tests caught, a deploy we ran twice because the output was cut off, an API that cannot draw, and a hand-copied palette where most tokens drifted. Each one changed how we work.');

// 18 · before / after (filled after measurement)
S('Before and after', [{ t: 'metrics' }], 'Before numbers are estimates and say so. After numbers are measured on this machine; the real Figma run time is printed by the plugin and goes into LINKS.md.');

// 19 · limits, then real vs simulated (rows from pitch/DEVPOST-FINAL.md "Real vs simulated")
const realRows = [
  ['Station hardware', 'REAL', C.mintTint, C.mint, 'Arduino UNO Q, 2 photoresistors, blue/white/red LEDs; one CSV line a second. One real aspirin run recorded Saturday. Reference profile not yet recorded; water-only control not yet run.'],
  ['Station app', 'REAL', C.mintTint, C.mint, 'Analysis, guided run, lid detection, guardrail; 14 tests pass. Live Claude scan ran Sat 19:19 on scan_1024_191752_f0c2 (replay of the real aspirin run): Unable to verify, no reference profile yet.'],
  ['Clinic app curves', 'REPLAY', C.skyTint, C.sky, 'Synthetic curves (B2-07, TM-02, B2-LID, AMX-01), labelled REPLAY on screen; the week of history is fixture data.'],
  ['Money', 'SIMULATED', C.greyTint, C.grey, 'USDC escrow simulated until a CDP key. x402: real 402 and signature check; paid 200 pending. Nessie mirror built, not run. SANDBOX / TESTNET only.'],
];
S('What PASS does not mean', [
  ...chrome('Limits · real vs simulated'),
  head(X, 150, 1500, [{ s: 'Pill screens tablets. ' }, { s: 'It does not grade them.', italic: true }], 92),
  card(X, 320, 810, 270, { fill: C.mintTint, stroke: 'rgba(95,211,154,0.45)' }),
  ...chip(X + 40, 350, 'PASS MEANS', C.surface, { dot: C.mint, size: 18 }),
  text(X + 40, 412, 730, "The dissolution curve of this one tablet, on this box, was consistent with the reference runs. No red flags found.", { size: 25, lh: 145 }),
  card(X + 870, 320, 810, 270, { fill: C.amberTint, stroke: 'rgba(224,154,58,0.40)' }),
  ...chip(X + 910, 350, 'PASS DOES NOT MEAN', C.surface, { dot: C.amber, size: 18 }),
  text(X + 910, 412, 730, 'That the tablet is the right drug, the right dose, or free of contaminants. Anything Pill cannot compare goes to a lab, by design.', { size: 25, lh: 145 }),
  eyebrow(X, 640, 'Real vs simulated, right now', 1200, { size: 17 }),
  ...realRows.flatMap(([piece, word, tint, dot, d], i) => {
    const y = 684 + i * 72;
    return [rect(X, y - 10, W - 2 * X, 1, { fill: C.line }),
      text(X, y, 300, piece, { size: 21, weight: 600, lh: 130 }),
      ...chip(X + 300, y - 3, word, tint, { dot, size: 15 }),
      text(X + 520, y, 1160, d, { size: 18, color: C.ink2, lh: 140 })];
  }),
], 'Say the limits before a judge asks. PASS, or Passed the screen in the station app, means this tablet dissolved like the reference runs; it never calls a medicine good or bad. Then what is real today: the UNO Q station and its app are real, and a live Claude scan ran Saturday at 19:19 on a replay of our real aspirin run; there is no reference profile yet, so it said Unable to verify, and the water-only control has not run. The clinic app replays labelled synthetic curves, escrow is simulated until a CDP key, and the paid x402 200 is pending. All money is SANDBOX or TESTNET.');

// 20 · tracks
const tracks = [
  ['Figma · Idea to Demo', C.violet, 'this deck, the plugin, the stage log'], ['Hardware Hack', C.sky, 'the station, on the table'], ['Hyphenate · finance agents', C.sky, 'policy agent: proposes, holds, escalates'],
  ['Coinbase · x402 payment agents', C.violet, '/verify over x402, USDC escrow (TESTNET)'], ['Capital One · Nessie', C.amber, 'sandbox mirror only if the key lands'], ['Microsoft · Built for the Real World', C.sky, 'a clinic pharmacist\u2019s delivery check'],
  ['Anthropic · Claude', C.mint, 'the plain-English why; can only downgrade'], ['People-First', C.mint, 'personal mode, read aloud'], ['Most Technically Complex', C.sky, 'two-sensor optics + rules + payments'],
  ['MLH · Gemini API', C.mint, 'reads the bottle label'], ['MLH · Gen AI', C.mint, 'models explain; rules decide'],
];
S('Tracks', [
  ...chrome('Tracks'),
  head(X, 150, 1400, 'One build, many judges.', 96),
  ...tracks.flatMap(([t, c, sub], i) => {
    const col = i % 3, row = Math.floor(i / 3), x = X + col * 570, y = 310 + row * 162;
    return [card(x, y, 540, 140, { radius: 20 }), rect(x + 22, y + 26, 6, 88, { fill: c, radius: 3 }),
      text(x + 50, y + 26, 470, t, { size: 27, weight: 600, lh: 130 }), text(x + 50, y + 70, 470, sub, { size: 21, color: C.ink2, lh: 135 })];
  }),
], 'One build, many judges; only the emphasis changes. Money is SANDBOX or TESTNET on every track.');

// 21 · ask / next
const next = [['1', 'A reference profile on the real box', 'Three or more runs of a known-good aspirin tablet, then the water-only control against it.'], ['2', 'A second reference drug', 'Each new drug needs its own profile. Until then it is UNABLE TO VERIFY, on purpose.'], ['3', 'One pharmacy, one week', 'A procurement officer samples one tablet per delivery; we log every decision and every override.']];
S('Ask and next', [
  ...chrome('Next'),
  head(X, 150, 1500, [{ s: 'Next: ' }, { s: 'real runs, one clinic.', italic: true }], 104),
  ...next.flatMap(([n, k, d], i) => {
    const y = 340 + i * 160;
    return [{ t: 'ellipse', x: X, y, w: 76, h: 76, fill: C.skyTint, stroke: C.sky, strokeW: 3 }, text(X, y + 12, 76, n, { font: 'serif', size: 48, align: 'center', lh: 100 }),
      text(X + 116, y + 2, 1400, k, { size: 34, weight: 600, lh: 130 }), text(X + 116, y + 52, 1400, d, { size: 27, color: C.ink2, lh: 140 })];
  }),
  card(X, 850, 1680, 120, { fill: C.skyTint, stroke: 'rgba(79,179,255,0.35)', radius: 22 }),
  text(X + 40, 874, 1600, 'Ask: try to make it say PASS on the chalk. Then tell us which tablet to calibrate next, and introduce us to one clinic pharmacist.', { size: 28, weight: 500, lh: 135 }),
], 'Our ask: try to make it say PASS on the chalk. Then tell us which tablet to calibrate next, and introduce us to one clinic pharmacist. Everything still pending is marked pending in the repo.');
if (slides.length !== TOTAL) throw new Error(`TOTAL is ${TOTAL} but ${slides.length} slides were built`);

// ───────────────────────────── design pages + board ─────────────────────────────
// The real station (photos/station; frames with people in the background left out) leads the App screens page.
const stationGroup = {
  title: 'The station · real photos (Sat)',
  sub: '4 photos (photos/station) + the chamber design drawing (pillgate/diagrams/03_chamber_cross_sections.png, top view)',
  items: [
    ...['17', '171', '19', '191'].map((n) => ({ name: `Station · photo ${n}`, label: `station-${n}`, img: img(`${PHOTO}/station-${n}.webp`, PHONE), kind: 'phone', route: null, source: `photos/station/station-${n}.jpg`, cropped: null })),
    { name: 'Station · chamber drawing (top view)', label: 'chamber top view', img: img(`${PHOTO}/chamber-top-view.webp`, { w: 640, cap: 0, q: 12 }), kind: 'desktop', route: null, source: 'pillgate/diagrams/03_chamber_cross_sections.png', cropped: null },
  ],
};
const design = {
  appScreens: { title: 'App screens', note: `The real station first (4 photos + the chamber drawing), then every app screenshot from pill/web/dev-shots (${appShotCount}), grouped by build pass in the order they were taken. Phone frames are 390 wide; each screenshot frame is named "App · <file>" and maps to a route.`, groups: [stationGroup, ...appGroups] },
  website: { title: 'Website', note: `Every site screenshot from pill-site/dev-shots (${siteShotCount}; shots of the first design excluded). Live: https://pill-site.vercel.app`, groups: siteGroups },
  tokens: { title: 'Tokens', note: `From pill/web/src/index.css :root (${appVars.length} declarations, ${tokens.length} unique tokens: ${tokenColors.length} colours → paint styles + COLOR variables, ${tokenNumbers.length} sizes → FLOAT variables). The app copied them by hand from pill-site/src/styles.css: ${drift.identical} of ${siteVars.length} arrived identical, ${drift.changed.length} changed value, ${drift.missing.length} were renamed or dropped.`, items: tokens, drift },
  stageLog: { title: 'Stage log', columns: stages.map((s) => s.name), rows: [['Tools', 'tools'], ['Minutes', 'minutes'], ['Rating (1–5)', 'rating'], ['What we did', 'did'], ['What broke', 'broke'], ['Into the project', 'forward']].map(([label, k]) => ({ label, cells: stages.map((s) => s[k]) })) },
  // Clickable prototype: the shipped screens (newest build pass) wired in order; the last screen returns to the first.
  prototype: {
    title: 'Prototype', flow: 'Pill · judge flow', size: { w: 390, h: 844 },
    note: 'Clickable judge flow, generated by the plugin from the shipped app screens (pill/web/dev-shots, newest pass), so the prototype always matches the code. Click anywhere on a screen to go to the next one. Present: ▶ in the top bar.',
    screens: [
      ['Welcome', '/welcome', newest('upgrade/a-onboarding-390.webp', 'v2/welcome-phone.webp')],
      ['Dashboard', '/', newest('upgrade/a-dashboard-390.webp', 'dashviz-dashboard-phone.webp')],
      ['Runs', '/runs', newest('upgrade/a-runs-390.webp', 'dashviz-runs-phone.webp')],
      ['Run · TM-02', '/run/:id', APP.run],
      ['Evaluation · NEEDS LAB', '/evaluation/:id', APP.needsLab],
      ['Delivery · held', '/delivery/:id', APP.heldTop],
      ['Pay · x402', '/pay', newest('upgrade/pay-awaiting-390.webp', 'upgrade/b-verify-390.webp')],
      ['Dashboard · after', '/', newest('upgrade/a-dashboard-390.webp', 'dashviz-dashboard-phone.webp')],
    ].map(([name, route, img]) => ({ name, route, img, src: IMAGES[img].src })),
  },
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
  const beforeMin = m.slides * m.perSlideMin + m.screens * m.perShotMin + m.tokenCount * m.perTokenMin;
  const BW = W - 2 * X, cold = typeof m.buildCold === 'number' ? m.buildCold : null;
  const afterW = cold == null ? 0 : Math.max(12, Math.round((BW * cold) / (beforeMin * 60)));
  return [
    ...chrome('Before and after', { n: mIdx + 1 }),
    head(X, 150, 1500, 'From hours to one click.', 92),
    ...chipRow(X, 296, [['BEFORE · BY HAND', C.surface, { stroke: C.line2, size: 17 }], ['ESTIMATE', C.amberTint, { dot: C.amber, size: 17 }]]),
    text(X, 356, 500, `≈ ${Math.round((beforeMin / 60) * 10) / 10} h`, { font: 'serif', size: 104, lh: 100 }),
    mono(X + 520, 374, 1160, `${m.slides} slides × ${m.perSlideMin} min + ${m.screens} screenshots × ${m.perShotMin} min + ${m.tokenCount} tokens × ${m.perTokenMin} min = ${beforeMin} min`, { size: 20, color: C.ink }),
    mono(X + 520, 412, 1160, 'Per-unit minutes are our assumption, not a measurement.', { size: 18 }),
    rect(X, 486, BW, 40, { fill: C.amber, radius: 20 }),
    ...chipRow(X, 576, [['AFTER · THE PLUGIN', C.surface, { stroke: C.line2, size: 17 }], ['MEASURED', C.mintTint, { dot: C.mint, size: 17 }]]),
    text(X, 636, 500, cold == null ? '[fill after running]' : `${cold} s`, { font: 'serif', size: 104, lh: 100 }),
    mono(X + 520, 654, 1160, `repo → deck.json + deck.html, cold build on this machine (${m.buildSec} s this run). Plugin logic on a stub Figma API: ${m.pluginStubMs.slides} ms Slides · ${m.pluginStubMs.figma} ms Design · ${m.pluginStubMs.figjam} ms FigJam.`, { size: 20, color: C.ink }),
    mono(X + 520, 720, 1160, `Plugin run in real Figma: ${m.realFigmaSec ? m.realFigmaSec + ' s' : '[fill after running]'}`, { size: 18 }),
    rect(X, 766, BW, 40, { fill: 'rgba(22,24,27,0.05)', radius: 20 }),
    ...(afterW ? [rect(X, 766, afterW, 40, { fill: C.mint, radius: 20 })] : []),
    mono(X + Math.max(afterW, 0) + 20, 776, 900, 'bars to scale · after = cold build time', { size: 16 }),
    rect(X, 860, BW, 2, { fill: C.line }),
    text(X, 884, BW, `Every run places ${m.screens} screenshots (${m.appShots} app, ${m.siteShots} site) and turns ${m.tokenCount} CSS variables into Figma styles and variables, with no hand work. By hand, ${m.drift.identical} of ${m.drift.siteTotal} site tokens reached the app unchanged.`, { size: 23, color: C.ink2, lh: 145 }),
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

// measure the plugin's own logic against a stub figma API (Node), then fill the before/after slide
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
  if (e.t === 'path') {
    const dash = e.dash ? ` stroke-dasharray="${e.dash.join(' ')}"` : '';
    return `<div style="${box}height:${e.h}px"><svg width="${e.w}" height="${e.h}" viewBox="0 0 ${e.w} ${e.h}" overflow="visible"><path d="${e.d}" fill="${e.fill || 'none'}" stroke="${e.stroke}" stroke-width="${e.strokeW}"${dash} stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
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
@page{size:1920px 1080px;margin:0}
@media print{html,body{background:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.deck{display:block;padding:0}.notes{display:none}.slide{display:block!important;transform:none!important;margin:0!important;break-before:page}.slide:first-of-type{break-before:auto}}
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
console.log(`Design     Prototype ${design.prototype.screens.length} screens · App screens ${appShotCount} (${appGroups.length} groups) · Website ${siteShotCount} · Tokens ${tokens.length} (${tokenColors.length} colours, ${tokenNumbers.length} sizes) · Stage log 4×6`);
console.log(`FigJam     ${figjam.sections.length} sections · ${figjam.sections.reduce((n, s) => n + (s.stickies?.length || 0) + (s.shapes?.length || 0), 0)} stickies/shapes`);
console.log(`plugin     stub run: ${m.pluginStubMs.slides} ms slides · ${m.pluginStubMs.figma} ms design · ${m.pluginStubMs.figjam} ms figjam`);
console.log(`deck.html  ${mb(html.length)} · build ${m.buildSec} s`);
console.log(`stage log  ${stages.map((s) => `${s.name} ${s.words}w`).join(' · ')}`);
if (json.length > 9 * 1048576) console.warn('WARNING: deck.json is over 9 MB; lower PHONE/DESK quality or width');
