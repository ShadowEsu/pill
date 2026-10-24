#!/usr/bin/env node
// Plan B: figma/deck.json → figma/pill-deck.pptx (16:9, 13.33 × 7.5 in), for File → Import in Figma Slides, PowerPoint or Keynote.
// Same slides, same coordinates as deck.html and the plugin: 1920 px = 13.33 in (144 px per inch, 1 px = 0.5 pt).
// Text, rectangles, ellipses, capsules and curves stay native shapes; screenshots are cropped to their frame (and their
// corners rounded) with ffmpeg first, because PowerPoint has no "fill from top" image fit. Speaker notes on every slide.
// Usage: (cd figma && npm i) once, then: node figma/build-pptx.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const deck = JSON.parse(fs.readFileSync(path.join(HERE, 'deck.json'), 'utf8'));
const OUT = path.join(HERE, 'pill-deck.pptx');
const TMP = path.join(os.tmpdir(), 'pill-pptx');
fs.mkdirSync(TMP, { recursive: true });

const PX = 144;                       // px per inch
const inch = (px) => +(px / PX).toFixed(4);
const pt = (px) => +(px / 2).toFixed(2);
const FACE = { sans: 'Inter', serif: 'Instrument Serif', mono: 'JetBrains Mono' };
// Figma Slides turns every imported text layer into Inter (help.figma.com/hc/en-us/articles/30601628883607), and Inter is
// much wider than Instrument Serif, so each serif text is scaled down (at most to 78 %) until, in Inter, it wraps to no more
// lines than it does in Instrument Serif: headings keep their line breaks and never run into the text below.
// Instrument Serif is condensed: "The box measures." at 140 px fits the title's 870 px box, so its advance is under 0.365 em.
const ADVANCE = { sans: 0.5, serif: 0.36, mono: 0.6, inter: 0.56 }; // average glyph advance in em, for wrapping estimates only
const plain = (e) => (Array.isArray(e.text) ? e.text.map((g) => g.s).join('') : e.text);
/** Greedy word wrap estimate: lines needed for `s` in a box `w` px wide at `size` px with average advance `adv` em. */
function wrapLines(s, w, size, adv) {
  return s.split('\n').reduce((n, para) => {
    let lines = 1, x = 0;
    for (const word of para.split(' ')) {
      const ww = (word.length + 1) * adv * size;
      if (x > 0 && x + ww > w) { lines++; x = 0; }
      x += ww;
    }
    return n + lines;
  }, 0);
}
function serifScale(e) {
  const s = plain(e), target = wrapLines(s, e.w, e.size, ADVANCE.serif);
  let k = 0.78;
  while (k > 0.5 && wrapLines(s, e.w, e.size * k, ADVANCE.inter) > target) k -= 0.02;
  return k;
}

/** '#RRGGBB' | 'rgba(r,g,b,a)' → { color: 'RRGGBB', transparency: 0-100 } (pptxgenjs: no '#', no alpha in the hex). */
function paint(c) {
  if (!c) return null;
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { color: hex, transparency: Math.round((1 - (m[4] == null ? 1 : +m[4])) * 100) };
  }
  const h = c.replace('#', '').toUpperCase();
  return { color: h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), transparency: 0 };
}
const fillOf = (c) => { const p = paint(c); return p ? { color: p.color, transparency: p.transparency } : { type: 'none' }; };
const lineOf = (c, w, o = {}) => { const p = paint(c); return p ? { color: p.color, transparency: p.transparency, width: pt(w || 2), ...o } : { type: 'none' }; };
const box = (e) => ({ x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h) });

// ── text ──
function textHeight(e, size) {
  const adv = e.font === 'serif' ? ADVANCE.inter : ADVANCE[e.font];
  return Math.ceil(wrapLines(plain(e), e.w, size, adv) * size * (e.lh / 100) + size * 0.2);
}
function addText(slide, e, name) {
  const size = e.font === 'serif' ? e.size * serifScale(e) : e.size;
  const runOpts = (g = {}) => {
    const p = paint(g.color || e.color);
    return { color: p.color, ...(p.transparency ? { transparency: p.transparency } : {}), bold: (g.weight || e.weight) >= 600, italic: !!(g.italic || e.italic) };
  };
  const runs = Array.isArray(e.text) ? e.text.map((g) => ({ text: g.s, options: runOpts(g) })) : [{ text: e.text, options: runOpts() }];
  slide.addText(runs, {
    ...box({ ...e, h: textHeight(e, size) }), objectName: name, margin: 0, valign: 'top', align: e.align || 'left', wrap: true, fit: 'none',
    fontFace: FACE[e.font] || FACE.sans, fontSize: pt(size), lineSpacingMultiple: +(e.lh / 100).toFixed(2),
    ...(e.ls ? { charSpacing: +((e.ls / 100) * pt(size)).toFixed(2) } : {}),
  });
}

// ── images: crop to the frame the HTML shows (fit top / cover / contain), round the corners, PNG ──
function framed(e) {
  const im = deck.images[e.img];
  const src = path.join(TMP, `${e.img}.jpg`);
  if (!fs.existsSync(src)) fs.writeFileSync(src, Buffer.from(im.b64, 'base64'));
  let place = { x: e.x, y: e.y, w: e.w, h: e.h }, crop;
  if (e.fit === 'contain') {
    const k = Math.min(e.w / im.w, e.h / im.h);
    place = { x: e.x + (e.w - im.w * k) / 2, y: e.y + (e.h - im.h * k) / 2, w: im.w * k, h: im.h * k };
    crop = { x: 0, y: 0, w: im.w, h: im.h };
  } else {
    const boxAR = e.h / e.w, imAR = im.h / im.w;
    if (imAR > boxAR) { const ch = Math.round(im.w * boxAR); crop = { x: 0, y: e.fit === 'top' ? 0 : Math.round((im.h - ch) / 2), w: im.w, h: ch }; }
    else { const cw = Math.round(im.h / boxAR); crop = { x: Math.round((im.w - cw) / 2), y: 0, w: cw, h: im.h }; }
  }
  const r = Math.round(((e.radius || 0) * crop.w) / place.w);
  const out = path.join(TMP, `${e.img}-${crop.x}-${crop.y}-${crop.w}x${crop.h}-r${r}.png`);
  if (!fs.existsSync(out)) {
    let vf = `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},format=rgba`;
    if (r > 0) {
      const a = `if(gt(abs(X-W/2),W/2-${r})*gt(abs(Y-H/2),H/2-${r}),if(lte(hypot(abs(X-W/2)-(W/2-${r}),abs(Y-H/2)-(H/2-${r})),${r}),255,0),255)`;
      vf += `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${a}'`;
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', vf, out]);
  }
  return { path: out, ...box(place) };
}

// ── capsule: track, level fill clipped to the capsule outline, outline on top ──
function capsulePoly(w, h, n = 24) {
  const pts = [];
  if (h >= w) { // vertical: top semicircle, bottom semicircle
    const r = w / 2;
    for (let i = 0; i <= n; i++) { const a = Math.PI + (Math.PI * i) / n; pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const a = (Math.PI * i) / n; pts.push([r + r * Math.cos(a), h - r + r * Math.sin(a)]); }
  } else {      // horizontal: right semicircle, left semicircle
    const r = h / 2;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; pts.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (Math.PI * i) / n; pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]); }
  }
  return pts;
}
/** Sutherland–Hodgman against one axis-aligned half-plane: keep points with p[axis] (<= or >=) v. */
function clip(poly, axis, v, keepLess) {
  const inside = (p) => (keepLess ? p[axis] <= v : p[axis] >= v);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) { const t = (v - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
const geom = (poly) => [...poly.map(([x, y], i) => ({ x: inch(x), y: inch(y), ...(i === 0 ? { moveTo: true } : {}) })), { close: true }];
function addCapsule(slide, pres, e) {
  const r = Math.min(e.w, e.h) / 2;
  slide.addShape(pres.ShapeType.roundRect, { ...box(e), rectRadius: inch(r), fill: fillOf(e.track), line: { type: 'none' } });
  if (e.level > 0) {
    const vert = e.h >= e.w;
    const poly = vert ? clip(capsulePoly(e.w, e.h), 1, e.h * (1 - e.level), false) : clip(capsulePoly(e.w, e.h), 0, e.w * e.level, true);
    if (poly.length > 2) slide.addShape(pres.ShapeType.custGeom, { ...box(e), points: geom(poly), fill: fillOf(e.fill), line: { type: 'none' } });
  }
  slide.addShape(pres.ShapeType.roundRect, { ...box(e), rectRadius: inch(r), fill: { type: 'none' }, line: lineOf(e.stroke, e.strokeW) });
}

// ── path: SVG d (M/L/C, absolute, space-separated) → custom geometry ──
function pathPoints(d) {
  const tk = d.trim().split(/[\s,]+/), pts = [];
  let i = 0, cmd = null;
  const num = () => inch(+tk[i++]);
  while (i < tk.length) {
    if (/^[MLCZ]$/i.test(tk[i])) cmd = tk[i++].toUpperCase();
    if (cmd === 'M') { pts.push({ x: num(), y: num(), moveTo: true }); cmd = 'L'; }
    else if (cmd === 'L') pts.push({ x: num(), y: num() });
    else if (cmd === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(); pts.push({ x: num(), y: num(), curve: { type: 'cubic', x1, y1, x2, y2 } }); }
    else if (cmd === 'Z') pts.push({ close: true });
    else throw new Error(`path: unsupported token ${tk[i]} in ${d.slice(0, 60)}`);
  }
  return pts;
}

// ── build ──
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 × 7.5 in = 1920 × 1080 at 144 px/in
pres.title = deck.title;
pres.author = 'Pill · Cal Hacks 13.0';
pres.company = 'Pill';
pres.subject = 'Pill deck (Plan B import for Figma Slides; same source as the plugin: figma/deck.json)';

let n = 0;
for (const s of deck.slides) {
  const slide = pres.addSlide();
  slide.background = { color: paint(s.bg).color };
  const titleIdx = s.els.findIndex((e) => e.t === 'text' && e.font === 'serif' && e.size >= 56);
  s.els.forEach((e, i) => {
    if (e.t === 'text') addText(slide, e, i === titleIdx ? 'Title' : `Text ${i + 1}`);
    else if (e.t === 'rect') {
      const r = Math.min(e.radius || 0, e.w / 2, e.h / 2);
      slide.addShape(r > 0 ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
        ...box(e), ...(r > 0 ? { rectRadius: inch(r) } : {}), fill: fillOf(e.fill), line: e.stroke ? lineOf(e.stroke, e.strokeW) : { type: 'none' },
        ...(e.shadow ? { shadow: { type: 'outer', color: '16181B', opacity: 0.22, blur: 24, offset: 12, angle: 90 } } : {}),
      });
    } else if (e.t === 'ellipse') {
      slide.addShape(pres.ShapeType.ellipse, { ...box(e), fill: fillOf(e.fill), line: e.stroke ? lineOf(e.stroke, e.strokeW) : { type: 'none' } });
    } else if (e.t === 'image') {
      slide.addImage({ ...framed(e), altText: `${s.name}: ${e.img}` });
    } else if (e.t === 'capsule') addCapsule(slide, pres, e);
    else if (e.t === 'path') {
      slide.addShape(pres.ShapeType.custGeom, { ...box(e), points: pathPoints(e.d), fill: fillOf(e.fill), line: lineOf(e.stroke, e.strokeW, e.dash ? { dashType: 'dash' } : {}) });
    } else throw new Error(`slide ${s.name}: unknown element ${e.t}`);
  });
  slide.addNotes(s.notes || '');
  n++;
}

await pres.writeFile({ fileName: OUT });
console.log(`pill-deck.pptx  ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB · ${n} slides · from deck.json ${deck.generatedAt}`);
