// Runs plugin/code.js in Node against a stub `figma` object, once per editor type, and times it.
// This measures the plugin's own work (decoding every image, laying out every node) and catches API misuse
// the stub enforces (text set before its font is loaded, non-JPEG/PNG image bytes, unknown editor paths).
// It does not measure Figma's renderer; the real run time is printed by the plugin itself.
import fs from 'node:fs';
import vm from 'node:vm';

const FONTS = { Inter: ['Regular', 'Italic', 'Medium', 'Medium Italic', 'Semi Bold', 'Semi Bold Italic', 'Bold', 'Bold Italic'], 'Instrument Serif': ['Regular', 'Italic'], 'JetBrains Mono': ['Regular', 'Medium', 'Bold'] };

function makeStub(editorType) {
  const loaded = new Set();
  const key = (f) => `${f.family}/${f.style}`;
  const stats = { nodes: 0, images: 0, texts: 0, slides: 0, notes: 0, styles: 0, variables: 0, stickies: 0, error: null, done: null };
  let ids = 0;
  const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
  class Node {
    constructor(type) { this.type = type; this.id = `${++ids}:1`; this.children = []; this.x = 0; this.y = 0; this.width = 100; this.height = 100; this.pd = {}; this.parent = null; this.name = type; stats.nodes++; }
    appendChild(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = this; this.children.push(c); }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.removed = true; }
    resize(w, h) { assert(w >= 0.01 && h >= 0.01, `${this.type}.resize(${w}, ${h})`); this.width = w; this.height = h; }
    resizeWithoutConstraints(w, h) { this.resize(w, h); }
    setPluginData(k, v) { assert(typeof v === 'string', 'plugin data must be a string'); this.pd[k] = v; }
    getPluginData(k) { return this.pd[k] || ''; }
    setSharedPluginData(ns, k, v) { assert(typeof v === 'string', 'shared plugin data must be a string'); }
    async loadAsync() {}
    async setFillStyleIdAsync(id) { assert(typeof id === 'string', 'style id'); }
  }
  class TextLike {
    constructor() { this._font = { family: 'Inter', style: 'Medium' }; this._chars = ''; }
    get fontName() { return this._font; }
    set characters(s) { assert(loaded.has(key(this._font)), `sticky/shape text set before loading ${key(this._font)}`); this._chars = s; }
    get characters() { return this._chars; }
  }
  class Text extends Node {
    constructor() { super('TEXT'); this._font = { family: 'Inter', style: 'Regular' }; this._chars = ''; this.fontSize = 12; stats.texts++; }
    set fontName(f) { assert(loaded.has(key(f)), `fontName ${key(f)} not loaded`); this._font = f; }
    get fontName() { return this._font; }
    set characters(s) { assert(loaded.has(key(this._font)), `characters set before loading ${key(this._font)}`); this._chars = s; }
    get characters() { return this._chars; }
    get height() { const w = this.width || 400, lines = this._chars.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil((l.length * this.fontSize * 0.5) / w)), 0); return lines * this.fontSize * 1.4; }
    set height(v) {}
    setRangeFontName(s, e, f) { assert(loaded.has(key(f)) && e <= this._chars.length, `range font ${key(f)}`); }
    setRangeFills(s, e, f) { assert(e <= this._chars.length && Array.isArray(f), 'range fills'); }
  }
  const page1 = new Node('PAGE'); page1.name = 'Page 1';
  const root = new Node('DOCUMENT'); root.appendChild(page1);
  const grid = [[new Node('SLIDE')]];
  const msgs = [];
  const ui = { postMessage: (m) => { msgs.push(m); if (m.type === 'error') stats.error = m.text; if (m.type === 'done') stats.done = m; }, onmessage: null };
  const figma = {
    editorType, ui, root, currentPage: page1,
    showUI() {}, notify() {},
    async listAvailableFontsAsync() { return Object.entries(FONTS).flatMap(([family, styles]) => styles.map((style) => ({ fontName: { family, style } }))); },
    async loadFontAsync(f) { assert(FONTS[f.family]?.includes(f.style), `font ${key(f)} does not exist`); loaded.add(key(f)); },
    base64Decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
    createImage(bytes) { assert(bytes instanceof Uint8Array || bytes?.constructor?.name === 'Uint8Array', 'createImage needs a Uint8Array'); assert((bytes[0] === 0xff && bytes[1] === 0xd8) || bytes[0] === 0x89, 'image bytes are not JPEG/PNG'); stats.images++; return { hash: `h${stats.images}` }; },
    createText: () => new Text(),
    createRectangle: () => new Node('RECTANGLE'),
    createEllipse: () => new Node('ELLIPSE'),
    createFrame: () => new Node('FRAME'),
    createPage() { const p = new Node('PAGE'); root.appendChild(p); return p; },
    async setCurrentPageAsync(p) { figma.currentPage = p; },
    viewport: { scrollAndZoomIntoView() {}, slidesMode: 'single-slide' },
    async getLocalPaintStylesAsync() { return []; },
    createPaintStyle() { stats.styles++; return { id: `S:${stats.styles}`, name: '', paints: [] }; },
    variables: {
      async getLocalVariableCollectionsAsync() { return []; },
      createVariableCollection(name) { return { name, modes: [{ modeId: '1:0' }], remove() {} }; },
      createVariable(name, coll, type) { assert(coll && coll.modes && ['COLOR', 'FLOAT'].includes(type), 'createVariable args'); stats.variables++; return { id: `V:${stats.variables}`, name, setValueForMode(m, v) { assert(v !== undefined && v !== null, `variable ${name} value`); } }; },
      createVariableAlias(v) { return { type: 'VARIABLE_ALIAS', id: v.id }; },
    },
    getSlideGrid() { assert(editorType === 'slides', 'getSlideGrid outside Slides'); return grid.map((r) => r.filter((s) => !s.removed)); },
    createSlide() { assert(editorType === 'slides', 'createSlide outside Slides'); const s = new Node('SLIDE'); s.width = 1920; s.height = 1080; Object.defineProperty(s, 'speakerNotes', { set(v) { stats.notes++; } }); grid[0].push(s); stats.slides++; return s; },
    createSection() { assert(editorType === 'figjam', 'createSection outside FigJam'); return new Node('SECTION'); },
    createSticky() { assert(editorType === 'figjam', 'createSticky outside FigJam'); stats.stickies++; const n = new Node('STICKY'); n.text = new TextLike(); return n; },
    createShapeWithText() { const n = new Node('SHAPE_WITH_TEXT'); n.text = new TextLike(); return n; },
    createConnector() { return new Node('CONNECTOR'); },
  };
  return { figma, ui, stats, msgs };
}

export async function measurePlugin(deck, { verbose = false } = {}) {
  const code = fs.readFileSync(new URL('./plugin/code.js', import.meta.url), 'utf8');
  const out = {};
  for (const editor of ['slides', 'figma', 'figjam']) {
    const { figma, ui, stats } = makeStub(editor);
    const ctx = vm.createContext({ figma, __html__: '<ui>', console });
    vm.runInContext(code, ctx, { filename: 'plugin/code.js' });
    const t0 = performance.now();
    await ui.onmessage({ type: 'build', deck });
    out[editor] = Math.round(performance.now() - t0);
    if (stats.error) throw new Error(`plugin stub run (${editor}) failed:\n${stats.error}`);
    if (verbose) console.log(editor, out[editor] + ' ms', JSON.stringify({ ...stats, done: stats.done && stats.done.what }));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const deck = JSON.parse(fs.readFileSync(new URL('./deck.json', import.meta.url), 'utf8'));
  console.log(await measurePlugin(deck, { verbose: true }));
}
