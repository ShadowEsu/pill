// Pill → Figma. Reads deck.json (made by figma/build-deck.mjs) and draws it in whichever editor it runs in:
//   Figma Slides → the pitch deck (one SlideNode per slide, speaker notes)
//   Figma Design → pages: Deck, App screens, Website, Tokens (paint styles + variables + sheet), Stage log
//   FigJam       → the ideation board (sections, stickies, the final three, the decision)
// Re-running replaces only what this plugin made earlier (nodes tagged with plugin data "pill-figma").
'use strict';

var MARK = 'pill-figma';
var deck = null;
var hashes = {};
var fontIdx = null;
var fontCache = {};
var warnings = [];

figma.showUI(__html__, { width: 400, height: 340, themeColors: true });

function say(text) { figma.ui.postMessage({ type: 'progress', text: text }); }

// ───────── colours ─────────
function rgba(v) {
  v = String(v).trim();
  var m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) { var n = parseInt(m[1], 16); return { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 }; }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a: m[4] === undefined ? 1 : +m[4] };
  return { r: 0, g: 0, b: 0, a: 1 };
}
function solid(v) { var c = rgba(v); return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }; }

// ───────── fonts: first available family per role, loaded before any text is set ─────────
var STYLES = {
  400: ['Regular', 'Book', 'Normal'],
  500: ['Medium', 'Regular'],
  600: ['Semi Bold', 'SemiBold', 'Semibold', 'Bold', 'Medium', 'Regular'],
  700: ['Bold', 'Semi Bold', 'SemiBold', 'Regular'],
};
async function fontFor(role, weight, italic) {
  var key = role + '/' + weight + '/' + (italic ? 'i' : 'n');
  if (fontCache[key]) return fontCache[key];
  if (!fontIdx) {
    fontIdx = {};
    var list = await figma.listAvailableFontsAsync();
    for (var i = 0; i < list.length; i++) {
      var f = list[i].fontName;
      (fontIdx[f.family] = fontIdx[f.family] || {})[f.style] = true;
    }
  }
  var families = (deck.fonts && deck.fonts[role]) || ['Inter'];
  var names = STYLES[weight] || STYLES[400];
  var tries = [];
  if (italic) {
    for (var a = 0; a < names.length; a++) tries.push(names[a] === 'Regular' ? 'Italic' : names[a] + ' Italic');
    tries.push('Italic');
  }
  tries = tries.concat(names);
  for (var fi = 0; fi < families.length; fi++) {
    var styles = fontIdx[families[fi]];
    if (!styles) continue;
    for (var t = 0; t < tries.length; t++) {
      if (styles[tries[t]]) {
        var fn = { family: families[fi], style: tries[t] };
        await figma.loadFontAsync(fn);
        if (fi > 0) warnings.push(role + ' font fell back to ' + fn.family);
        fontCache[key] = fn;
        return fn;
      }
    }
  }
  var fallback = { family: 'Inter', style: 'Regular' };
  await figma.loadFontAsync(fallback);
  fontCache[key] = fallback;
  return fallback;
}

// ───────── images: base64 → Uint8Array → figma.createImage ─────────
function b64ToBytes(b64) {
  if (figma.base64Decode) return figma.base64Decode(b64);
  var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var lookup = new Uint8Array(256);
  for (var i = 0; i < abc.length; i++) lookup[abc.charCodeAt(i)] = i;
  var len = b64.length, pad = b64[len - 1] === '=' ? (b64[len - 2] === '=' ? 2 : 1) : 0;
  var out = new Uint8Array((len * 3) / 4 - pad), p = 0;
  for (var j = 0; j < len; j += 4) {
    var n = (lookup[b64.charCodeAt(j)] << 18) | (lookup[b64.charCodeAt(j + 1)] << 12) | (lookup[b64.charCodeAt(j + 2)] << 6) | lookup[b64.charCodeAt(j + 3)];
    if (p < out.length) out[p++] = (n >> 16) & 255;
    if (p < out.length) out[p++] = (n >> 8) & 255;
    if (p < out.length) out[p++] = n & 255;
  }
  return out;
}
function imageHash(id) {
  if (!hashes[id]) {
    var meta = deck.images[id];
    if (!meta) throw new Error('deck.json has no image "' + id + '"');
    hashes[id] = figma.createImage(b64ToBytes(meta.b64)).hash;
  }
  return hashes[id];
}
/** Image paint. fit: 'top' = cover, anchored to the top edge; 'cover'; 'contain'. */
function imagePaint(id, w, h, fit) {
  var hash = imageHash(id), meta = deck.images[id];
  if (fit === 'contain') return { type: 'IMAGE', imageHash: hash, scaleMode: 'FIT' };
  if (fit === 'top') {
    var nodeAspect = h / w, imgAspect = meta.h / meta.w;
    var sx = 1, sy = 1, tx = 0;
    if (imgAspect > nodeAspect) sy = nodeAspect / imgAspect; else { sx = imgAspect / nodeAspect; tx = (1 - sx) / 2; }
    return { type: 'IMAGE', imageHash: hash, scaleMode: 'CROP', imageTransform: [[sx, 0, tx], [0, sy, 0]] };
  }
  return { type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' };
}

// ───────── element renderer (same element list deck.html renders) ─────────
function place(parent, node, x, y) { parent.appendChild(node); node.x = x; node.y = y; return node; }
function shadow() { return [{ type: 'DROP_SHADOW', color: { r: 0.086, g: 0.094, b: 0.106, a: 0.18 }, offset: { x: 0, y: 24 }, radius: 48, spread: -12, visible: true, blendMode: 'NORMAL' }]; }
function stroke(node, e) {
  if (!e.stroke) return;
  node.strokes = [solid(e.stroke)];
  node.strokeWeight = e.strokeW || 2;
  node.strokeAlign = 'INSIDE';
}
async function makeText(e) {
  var segs = Array.isArray(e.text) ? e.text : [{ s: String(e.text) }];
  var node = figma.createText();
  node.fontName = await fontFor(e.font || 'sans', e.weight || 400, !!e.italic);
  node.characters = segs.map(function (g) { return g.s; }).join('');
  node.fontSize = e.size || 30;
  node.lineHeight = { value: e.lh || 140, unit: 'PERCENT' };
  node.letterSpacing = { value: e.ls || 0, unit: 'PERCENT' };
  node.textAlignHorizontal = (e.align || 'left').toUpperCase() === 'CENTER' ? 'CENTER' : (e.align === 'right' ? 'RIGHT' : 'LEFT');
  node.fills = [solid(e.color || '#16181B')];
  var at = 0;
  for (var i = 0; i < segs.length; i++) {
    var g = segs[i], end = at + g.s.length;
    if (end > at && (g.italic || g.weight || g.font)) node.setRangeFontName(at, end, await fontFor(g.font || e.font || 'sans', g.weight || e.weight || 400, g.italic === undefined ? !!e.italic : !!g.italic));
    if (end > at && g.color) node.setRangeFills(at, end, [solid(g.color)]);
    at = end;
  }
  node.resize(e.w, Math.max(1, node.height));
  node.textAutoResize = 'HEIGHT';
  return node;
}
async function render(parent, els, ox, oy) {
  ox = ox || 0; oy = oy || 0;
  for (var i = 0; i < els.length; i++) {
    var e = els[i], node;
    if (e.t === 'text') {
      node = await makeText(e);
      node.name = (Array.isArray(e.text) ? e.text.map(function (g) { return g.s; }).join('') : String(e.text)).slice(0, 40);
    } else if (e.t === 'rect' || e.t === 'image') {
      node = figma.createRectangle();
      node.resize(Math.max(1, e.w), Math.max(1, e.h));
      node.cornerRadius = e.radius || 0;
      node.fills = e.t === 'image' ? [imagePaint(e.img, e.w, e.h, e.fit)] : [solid(e.fill)];
      node.name = e.t === 'image' ? e.img : 'rect';
      stroke(node, e);
      if (e.shadow) node.effects = shadow();
    } else if (e.t === 'ellipse') {
      node = figma.createEllipse();
      node.resize(e.w, e.h);
      node.fills = e.fill ? [solid(e.fill)] : [];
      stroke(node, e);
    } else if (e.t === 'capsule') {
      node = figma.createFrame();
      node.name = 'pill fill ' + Math.round(e.level * 100) + '%';
      node.resize(e.w, e.h);
      node.cornerRadius = Math.min(e.w, e.h) / 2;
      node.clipsContent = true;
      node.fills = [solid(e.track)];
      stroke(node, e);
      var lvl = figma.createRectangle(), vert = e.h >= e.w;
      lvl.fills = [solid(e.fill)];
      lvl.name = 'level';
      if (vert) { lvl.resize(e.w, Math.max(1, e.h * e.level)); place(node, lvl, 0, e.h - e.h * e.level); }
      else { lvl.resize(Math.max(1, e.w * e.level), e.h); place(node, lvl, 0, 0); }
    } else {
      continue;
    }
    place(parent, node, ox + e.x, oy + e.y);
  }
}

// ───────── helpers ─────────
function tag(node, id) { node.setPluginData(MARK, id || '1'); return node; }
async function txt(parent, x, y, w, s, o) {
  o = o || {};
  var n = await makeText({ text: s, w: w, size: o.size || 24, font: o.font || 'sans', weight: o.weight || 400, italic: o.italic, color: o.color || '#16181B', lh: o.lh || 140, ls: o.ls || 0, align: o.align });
  if (parent) place(parent, n, x, y);
  return n;
}

// ───────── Figma Slides ─────────
async function buildSlides() {
  var old = [];
  var grid = figma.getSlideGrid();
  for (var r = 0; r < grid.length; r++) for (var c = 0; c < grid[r].length; c++) {
    var s = grid[r][c];
    if (s.getPluginData(MARK) || s.children.length === 0) old.push(s);
  }
  var notesOk = true;
  for (var i = 0; i < deck.slides.length; i++) {
    var sd = deck.slides[i];
    say('Slide ' + (i + 1) + ' / ' + deck.slides.length + ' · ' + sd.name);
    var slide = tag(figma.createSlide(), sd.id);
    slide.name = String(i + 1).padStart(2, '0') + ' · ' + sd.name;
    try { slide.fills = [solid(sd.bg)]; } catch (err) { warnings.push('slide background not settable'); }
    await render(slide, sd.els);
    if (sd.notes) { try { slide.speakerNotes = sd.notes; } catch (err) { notesOk = false; } }
  }
  for (var k = 0; k < old.length; k++) { try { old[k].remove(); } catch (err) { /* a deck must keep one slide */ } }
  if (!notesOk) warnings.push('speaker notes not supported by this Figma version; notes are in deck.html');
  try { figma.viewport.slidesMode = 'grid'; } catch (err) { /* older API */ }
  return deck.slides.length + ' slides';
}

// ───────── Figma Design ─────────
var firstPageUsed = false;
async function pageNamed(name) {
  var pages = figma.root.children, p = null;
  for (var i = 0; i < pages.length; i++) if (pages[i].name === name) p = pages[i];
  if (p) {
    await p.loadAsync();
    var kids = p.children.slice();
    for (var j = 0; j < kids.length; j++) if (kids[j].getPluginData(MARK)) kids[j].remove();
  } else if (!firstPageUsed && figma.currentPage.children.length === 0) {
    p = figma.currentPage;
    p.name = name;
  } else {
    try {
      p = figma.createPage();
      p.name = name;
    } catch (err) {
      // Starter plan caps pages per file: put this "page" in a tagged frame on the current page instead.
      warnings.push('could not add page "' + name + '" (' + err.message + '); drew it as a frame on the current page');
      p = tag(figma.createFrame(), name);
      p.name = name;
      p.fills = [];
      p.clipsContent = false;
      p.resize(100, 100);
      var host = figma.currentPage, right = 0;
      for (var h = 0; h < host.children.length; h++) right = Math.max(right, host.children[h].x + host.children[h].width);
      place(host, p, right + 2000, 0);
    }
  }
  firstPageUsed = true;
  return p;
}
async function deckPage() {
  var page = await pageNamed('Deck');
  var cols = 4, gap = 160, W = deck.size.w, H = deck.size.h;
  for (var i = 0; i < deck.slides.length; i++) {
    var sd = deck.slides[i];
    say('Deck frame ' + (i + 1) + ' / ' + deck.slides.length);
    var f = tag(figma.createFrame(), sd.id);
    f.name = String(i + 1).padStart(2, '0') + ' · ' + sd.name;
    f.resize(W, H);
    f.fills = [solid(sd.bg)];
    f.clipsContent = true;
    place(page, f, (i % cols) * (W + gap), Math.floor(i / cols) * (H + gap));
    await render(f, sd.els);
  }
  return page;
}
/** Screenshot gallery: one row per group, phones 390 wide, desktops 960 wide. */
async function galleryPage(name, spec) {
  var page = await pageNamed(name);
  var y = 0;
  tag(await txt(page, 0, y, 2400, spec.title, { font: 'serif', size: 96, lh: 100 }));
  y += 120;
  tag(await txt(page, 0, y, 2400, spec.note, { size: 24, color: '#4A4E55' }));
  y += 120;
  var maxRow = 4800;
  for (var g = 0; g < spec.groups.length; g++) {
    var grp = spec.groups[g];
    say(name + ' · ' + grp.title);
    tag(await txt(page, 0, y, 2400, grp.title, { font: 'serif', size: 64, lh: 100 }));
    tag(await txt(page, 0, y + 80, 2400, grp.sub, { font: 'mono', size: 20, color: '#7C8188' }));
    y += 150;
    var x = 0, rowH = 0;
    for (var i = 0; i < grp.items.length; i++) {
      var it = grp.items[i], meta = deck.images[it.img];
      var fw = it.kind === 'phone' ? 390 : 960, fh = Math.round(fw * meta.h / meta.w);
      if (x > 0 && x + fw > maxRow) { x = 0; y += rowH + 80; rowH = 0; }
      var f = tag(figma.createFrame(), it.name);
      f.name = it.name;
      f.resize(fw, fh);
      f.cornerRadius = it.kind === 'phone' ? 28 : 12;
      f.clipsContent = true;
      f.fills = [{ type: 'IMAGE', imageHash: imageHash(it.img), scaleMode: 'FILL' }];
      f.strokes = [solid('rgba(22,24,27,0.18)')];
      f.strokeWeight = 1;
      f.effects = shadow();
      if (it.route) f.setSharedPluginData('pill', 'route', it.route);
      if (it.source) f.setSharedPluginData('pill', 'source', it.source);
      place(page, f, x, y);
      var label = it.label + (it.route ? '  →  ' + it.route : '') + (it.cropped ? '  · first screen of ' + it.cropped : '');
      tag(await txt(page, x, y + fh + 14, fw, label, { font: 'mono', size: 16, color: '#4A4E55', lh: 130 }));
      x += fw + 60;
      rowH = Math.max(rowH, fh + 60);
    }
    y += rowH + 160;
  }
  return page;
}
async function tokensPage() {
  var spec = deck.design.tokens;
  var page = await pageNamed('Tokens');
  say('Tokens · paint styles');
  var styles = await figma.getLocalPaintStylesAsync();
  var byName = {};
  for (var s = 0; s < styles.length; s++) byName[styles[s].name] = styles[s];
  var colorTokens = spec.items.filter(function (t) { return t.kind === 'color'; });
  var styleFor = {};
  for (var i = 0; i < colorTokens.length; i++) {
    var t = colorTokens[i], nm = 'pill/' + t.name;
    var st = byName[nm] || figma.createPaintStyle();
    st.name = nm;
    st.description = t.css + ': ' + t.value + '  (pill/web/src/index.css)';
    st.paints = [{ type: 'SOLID', color: { r: t.rgba.r, g: t.rgba.g, b: t.rgba.b }, opacity: t.rgba.a }];
    styleFor[t.name] = st;
  }
  // variables (Design only; Slides has none)
  var varCount = 0;
  try {
    say('Tokens · variables');
    var cols = await figma.variables.getLocalVariableCollectionsAsync();
    for (var c = 0; c < cols.length; c++) if (cols[c].name === 'Pill tokens') cols[c].remove();
    var coll = figma.variables.createVariableCollection('Pill tokens');
    var mode = coll.modes[0].modeId, made = {};
    var ordered = spec.items.filter(function (t) { return t.kind !== 'text' && !t.alias; }).concat(spec.items.filter(function (t) { return t.kind !== 'text' && t.alias; }));
    for (var v = 0; v < ordered.length; v++) {
      var tk = ordered[v];
      var variable = figma.variables.createVariable(tk.name, coll, tk.kind === 'color' ? 'COLOR' : 'FLOAT');
      variable.description = tk.css + ': ' + tk.value;
      if (tk.alias && made[tk.alias]) variable.setValueForMode(mode, figma.variables.createVariableAlias(made[tk.alias]));
      else if (tk.kind === 'color') variable.setValueForMode(mode, { r: tk.rgba.r, g: tk.rgba.g, b: tk.rgba.b, a: tk.rgba.a });
      else variable.setValueForMode(mode, tk.number);
      made[tk.name] = variable;
      varCount++;
    }
  } catch (err) {
    warnings.push('variables not created: ' + err.message);
  }
  // the sheet
  say('Tokens · sheet');
  tag(await txt(page, 0, 0, 2600, 'Tokens', { font: 'serif', size: 96, lh: 100 }));
  tag(await txt(page, 0, 120, 2600, spec.note, { size: 24, color: '#4A4E55' }));
  var x0 = 0, y0 = 260, cw = 300, ch = 230, perRow = 8;
  for (var k = 0; k < colorTokens.length; k++) {
    var tok = colorTokens[k], cx = x0 + (k % perRow) * (cw + 30), cy = y0 + Math.floor(k / perRow) * (ch + 30);
    var cardF = tag(figma.createFrame(), tok.name);
    cardF.name = '--' + tok.name;
    cardF.resize(cw, ch);
    cardF.cornerRadius = 20;
    cardF.fills = [solid('#FFFFFF')];
    cardF.strokes = [solid('rgba(22,24,27,0.10)')];
    cardF.strokeWeight = 1;
    cardF.clipsContent = true;
    place(page, cardF, cx, cy);
    var sw = figma.createRectangle();
    sw.resize(cw, 130);
    await sw.setFillStyleIdAsync(styleFor[tok.name].id);
    place(cardF, sw, 0, 0);
    await txt(cardF, 18, 146, cw - 36, '--' + tok.name, { font: 'mono', size: 18, weight: 500, lh: 130 });
    await txt(cardF, 18, 176, cw - 36, tok.value, { font: 'mono', size: 15, color: '#7C8188', lh: 130 });
  }
  var ny = y0 + Math.ceil(colorTokens.length / perRow) * (ch + 30) + 40;
  var rest = spec.items.filter(function (t) { return t.kind !== 'color'; });
  tag(await txt(page, 0, ny, 2600, 'Sizes, fonts and motion', { font: 'serif', size: 56, lh: 100 }));
  tag(await txt(page, 0, ny + 80, 2600, rest.map(function (t) { return t.css + ': ' + t.value; }).join('\n'), { font: 'mono', size: 20, color: '#4A4E55', lh: 150 }));
  var d = spec.drift;
  if (d && d.changed.length) {
    tag(await txt(page, 1400, ny, 1200, 'Hand handoff drift (site → app)', { font: 'serif', size: 56, lh: 100 }));
    tag(await txt(page, 1400, ny + 80, 1200, d.changed.join('\n') + '\nrenamed or dropped: ' + d.missing.join(', '), { font: 'mono', size: 18, color: '#4A4E55', lh: 150 }));
  }
  return colorTokens.length + ' paint styles, ' + varCount + ' variables';
}
async function stageLogPage() {
  var spec = deck.design.stageLog;
  var page = await pageNamed('Stage log');
  say('Stage log');
  tag(await txt(page, 0, 0, 2400, 'Stage log', { font: 'serif', size: 96, lh: 100 }));
  tag(await txt(page, 0, 120, 2400, 'From figma/STAGE-LOG.md. Minutes from git commit times; steps not yet run are marked.', { size: 24, color: '#4A4E55' }));
  var widths = [240].concat(spec.columns.map(function () { return 520; }));
  var table = tag(figma.createFrame(), 'table');
  table.name = 'Stage log table';
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'AUTO';
  table.itemSpacing = 0;
  table.fills = [solid('#FFFFFF')];
  table.cornerRadius = 16;
  table.clipsContent = true;
  table.strokes = [solid('rgba(22,24,27,0.18)')];
  table.strokeWeight = 1;
  place(page, table, 0, 220);
  var rows = [{ label: 'Stage', cells: spec.columns, head: true }].concat(spec.rows);
  for (var r = 0; r < rows.length; r++) {
    var row = figma.createFrame();
    row.name = rows[r].label;
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisSizingMode = 'AUTO';
    row.counterAxisSizingMode = 'AUTO';
    row.itemSpacing = 0;
    row.fills = rows[r].head ? [solid('#EEF2F0')] : [];
    table.appendChild(row);
    var cells = [rows[r].label].concat(rows[r].cells), made = [];
    for (var c = 0; c < cells.length; c++) {
      var cell = figma.createFrame();
      cell.name = c === 0 ? 'label' : spec.columns[c - 1];
      cell.layoutMode = 'VERTICAL';
      cell.primaryAxisSizingMode = 'AUTO';
      cell.counterAxisSizingMode = 'FIXED';
      cell.resize(widths[c], 10);
      cell.paddingLeft = cell.paddingRight = 24;
      cell.paddingTop = cell.paddingBottom = 20;
      cell.fills = c === 0 && !rows[r].head ? [solid('#F7F8F7')] : [];
      cell.strokes = [solid('rgba(22,24,27,0.10)')];
      cell.strokeWeight = 1;
      row.appendChild(cell);
      var head = rows[r].head || c === 0;
      var t = await txt(null, 0, 0, widths[c] - 48, String(cells[c] || ''), head ? { font: rows[r].head ? 'serif' : 'mono', size: rows[r].head ? 40 : 18, weight: 500, lh: 120 } : { size: 20, color: '#16181B', lh: 145 });
      cell.appendChild(t);
      t.layoutAlign = 'STRETCH';
      t.textAutoResize = 'HEIGHT';
      made.push(cell);
    }
    var h = 0;
    for (var m = 0; m < made.length; m++) h = Math.max(h, made[m].height);
    for (var m2 = 0; m2 < made.length; m2++) { made[m2].primaryAxisSizingMode = 'FIXED'; made[m2].resize(widths[m2], h); }
  }
  return page;
}
async function buildDesign() {
  var deckP = await deckPage();
  await galleryPage('App screens', deck.design.appScreens);
  await galleryPage('Website', deck.design.website);
  var tokenInfo = await tokensPage();
  await stageLogPage();
  if (deckP.type === 'PAGE') await figma.setCurrentPageAsync(deckP);
  figma.viewport.scrollAndZoomIntoView(deckP.type === 'PAGE' ? deckP.children : [deckP]);
  return 'Deck (' + deck.slides.length + ' frames), App screens, Website, Tokens (' + tokenInfo + '), Stage log';
}

// ───────── FigJam ─────────
async function stickyText(node, s) {
  await figma.loadFontAsync(node.text.fontName);
  node.text.characters = s;
}
async function buildFigJam() {
  var spec = deck.figjam, page = figma.currentPage;
  var kids = page.children.slice();
  for (var i = 0; i < kids.length; i++) if (kids[i].getPluginData(MARK)) kids[i].remove();
  tag(await txt(page, 0, 0, 3000, spec.title, { font: 'serif', size: 120, lh: 100 }));
  tag(await txt(page, 0, 150, 2400, spec.subtitle, { size: 28, color: '#4A4E55' }));
  var y = 330, SW = 240, GAP = 30, PAD = 60, perRow = 6;
  var lotShape = null, firstDecision = null;
  for (var s = 0; s < spec.sections.length; s++) {
    var sec = spec.sections[s];
    say('Board · ' + sec.title);
    var items = (sec.shapes || []).length ? sec.shapes : (sec.stickies || []);
    var isShapes = !!(sec.shapes && sec.shapes.length);
    var iw = isShapes ? 520 : SW, ih = isShapes ? 300 : SW;
    var n = Math.min(perRow, items.length), rowsN = Math.ceil(items.length / perRow);
    var section = tag(figma.createSection(), sec.title);
    section.name = sec.title;
    var c = rgba(sec.color);
    section.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: 0.12 }];
    section.resizeWithoutConstraints(Math.max(1400, PAD * 2 + n * (iw + GAP) - GAP), PAD * 2 + 60 + rowsN * (ih + GAP) - GAP);
    place(page, section, 0, y);
    for (var k = 0; k < items.length; k++) {
      var it = items[k], x = PAD + (k % perRow) * (iw + GAP), yy = PAD + 60 + Math.floor(k / perRow) * (ih + GAP), node;
      if (isShapes) {
        node = figma.createShapeWithText();
        node.shapeType = 'ROUNDED_RECTANGLE';
        node.resize(iw, ih);
        node.fills = [solid(it.color)];
        await stickyText(node, it.text);
        if (it.winner) lotShape = node;
      } else {
        node = figma.createSticky();
        node.fills = [solid(it.color)];
        await stickyText(node, it.text);
        if (s === spec.sections.length - 1 && !firstDecision) firstDecision = node;
      }
      place(section, node, x, yy);
    }
    y += section.height + 120;
  }
  if (lotShape && firstDecision && figma.createConnector) {
    var con = tag(figma.createConnector(), 'decision-link');
    con.connectorStart = { endpointNodeId: lotShape.id, magnet: 'AUTO' };
    con.connectorEnd = { endpointNodeId: firstDecision.id, magnet: 'AUTO' };
    con.strokes = [solid('#2FA874')];
    con.strokeWeight = 6;
  }
  figma.viewport.scrollAndZoomIntoView(page.children);
  return spec.sections.length + ' sections';
}

// ───────── entry ─────────
figma.ui.onmessage = async function (msg) {
  if (!msg || msg.type !== 'build') return;
  deck = msg.deck;
  hashes = {};
  warnings = [];
  var t0 = Date.now();
  try {
    if (!deck || !deck.slides || !deck.images) throw new Error('This is not a Pill deck.json (run node figma/build-deck.mjs).');
    var what;
    if (figma.editorType === 'slides') what = await buildSlides();
    else if (figma.editorType === 'figma') what = await buildDesign();
    else if (figma.editorType === 'figjam') what = await buildFigJam();
    else throw new Error('Open a Figma Slides, Design or FigJam file (this is "' + figma.editorType + '").');
    var sec = ((Date.now() - t0) / 1000).toFixed(1);
    var stamp = new Date().toISOString();
    figma.root.setPluginData('pill-build', JSON.stringify({ editor: figma.editorType, seconds: +sec, at: stamp, images: Object.keys(hashes).length }));
    figma.notify('Pill → Figma: ' + what + ' in ' + sec + ' s');
    figma.ui.postMessage({ type: 'done', editor: figma.editorType, seconds: +sec, at: stamp, what: what, images: Object.keys(hashes).length, warnings: warnings });
  } catch (err) {
    figma.notify('Pill → Figma failed: ' + err.message, { error: true });
    figma.ui.postMessage({ type: 'error', text: String(err && err.stack || err) });
  }
};
