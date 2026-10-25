// "How the money moves, and who decides": one data table (nodes, arrows, notes, models), two layouts.
// flowSvg() draws the wide diagram (four columns, the x402 lane; with { standalone: true } also a title and the
// models table, 1600 × 900, for public/diagrams/money-flow.svg and the Devpost PNG). flowStack() lays the same
// nodes out as stacked HTML cards for narrow screens. mountFlow(el) puts both on the page plus the models table.
// Facts follow pitch/FLOW-SPEC.md. Words stay ink; colour lives only in fills; red only for Hold.

const INK = '#16181B';
const INK2 = '#3F444B';
const SANS = 'Inter, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", Menlo, Consolas, monospace';
const FILL = {
  paper: '#FFFFFF',
  station: 'rgba(124,110,230,0.18)',
  pass: 'rgba(47,181,119,0.22)',
  lab: 'rgba(230,150,40,0.26)',
  unable: 'rgba(124,129,136,0.20)',
  hold: 'rgba(214,48,49,0.18)',
  cb: 'rgba(0,82,255,0.12)',
  cbSoft: 'rgba(0,82,255,0.05)',
  core: 'rgba(22,24,27,0.05)',
};

/* ---------- the table ---------- */
// g: group (for the stacked layout); x, y, w, h: wide layout; title + body lines; via: the connector shown
// above the card in the stacked layout; stack: 'card' | 'row' (cards side by side) | 'chip' (inline input).
export const NODES = [
  // 1 · Measure
  { id: 'tablet', g: 'measure', x: 30, y: 80, w: 250, h: 48, title: 'One tablet', body: [], fill: 'paper' },
  { id: 'station', g: 'measure', x: 30, y: 152, w: 250, h: 124, title: 'Station · Arduino UNO Q', body: ['blue · white · red LEDs', '2 photoresistors', '1 CSV line a second', 'the firmware decides nothing'], fill: 'station', via: '↓' },
  { id: 'analysis', g: 'measure', x: 30, y: 300, w: 250, h: 72, title: 'analysis.py', body: ['deterministic: curve maths,', 'quality gates'], mono: true, fill: 'paper', via: '↓' },
  // 2 · Three answers
  { id: 'pass', g: 'answers', x: 340, y: 110, w: 200, h: 54, title: 'Passed the screen', body: [], fill: 'pass', stack: 'row' },
  { id: 'lab', g: 'answers', x: 340, y: 210, w: 200, h: 54, title: 'Needs lab testing', body: [], fill: 'lab', stack: 'row' },
  { id: 'unable', g: 'answers', x: 340, y: 310, w: 200, h: 54, title: 'Unable to verify', body: [], fill: 'unable', stack: 'row' },
  // 3 · The policy agent
  { id: 'verdictIn', g: 'policy', svg: false, title: 'The verdict', stack: 'chip' },
  { id: 'recall', g: 'policy', x: 600, y: 76, w: 210, h: 64, title: 'Recall lookup', body: ['openFDA, by lot'], fill: 'paper', stack: 'chip' },
  { id: 'label', g: 'policy', x: 830, y: 76, w: 200, h: 64, title: 'Bottle label', body: ['Gemini → editable fields;', 'unreadable = null'], fill: 'paper', stack: 'chip' },
  { id: 'invoice', g: 'policy', x: 600, y: 338, w: 210, h: 50, title: 'Invoice amount vs cap', body: [], fill: 'paper', stack: 'chip' },
  { id: 'tap', g: 'policy', x: 830, y: 338, w: 200, h: 50, title: 'Pharmacist’s tap', body: [], fill: 'paper', stack: 'chip' },
  { id: 'policy', g: 'policy', x: 640, y: 182, w: 370, h: 116, title: 'Policy agent · clinic app (pill/pay)', body: ['Six clauses P1–P6, in code → a ceiling.', 'Claude may only return the ceiling', 'or escalate.'], fill: 'core', strong: true, via: '↓ five inputs in' },
  { id: 'release', g: 'policy', x: 1080, y: 100, w: 210, h: 72, title: 'Release', body: ['if Passed, no recall,', 'within cap, and a tap'], fill: 'pass', stack: 'row', via: '↓ one decision out' },
  { id: 'hold', g: 'policy', x: 1080, y: 204, w: 210, h: 72, title: 'Hold', body: ['+ lab referral draft', 'on Needs lab testing'], fill: 'hold', stack: 'row' },
  { id: 'escalate', g: 'policy', x: 1080, y: 308, w: 210, h: 72, title: 'Escalate', body: ['to a person; nothing moves', 'on Unable to verify'], fill: 'unable', stack: 'row' },
  // 4 · The money (Coinbase)
  { id: 'clinic', g: 'money', x: 1320, y: 319, w: 150, h: 50, title: 'pill-clinic', body: ['pays in'], mono: true, fill: 'cb' },
  { id: 'escrow', g: 'money', x: 1320, y: 215, w: 150, h: 50, title: 'pill-escrow', body: ['holds it'], mono: true, fill: 'cb', via: '↓ hold, when the delivery is logged' },
  { id: 'supplier', g: 'money', x: 1320, y: 111, w: 150, h: 50, title: 'pill-supplier', body: ['is paid'], mono: true, fill: 'cb', via: '↓ release (or ↑ refund to pill-clinic)' },
  { id: 'mode', g: 'money', x: 1320, y: 392, w: 262, h: 40, title: '', body: ['escrow moves: mode: simulated', 'until a CDP key'], mono: true, fill: 'cbSoft', chip: true },
  { id: 'nessie', g: 'money', x: 1320, y: 444, w: 262, h: 70, title: 'Capital One Nessie', body: ['mirrors every move in', 'sandbox dollars (SANDBOX)'], fill: 'paper' },
  // the x402 lane
  { id: 'buyer', g: 'x402', x: 50, y: 572, w: 228, h: 80, title: 'Buyer agent', body: ['another clinic, or an agent', 'with no local reference'], fill: 'paper' },
  { id: 'post', g: 'x402', x: 304, y: 572, w: 228, h: 80, title: 'POST /verify', body: ['with a curve'], mono: true, fill: 'paper', via: '↓' },
  { id: 'p402', g: 'x402', x: 558, y: 572, w: 228, h: 80, title: '402 Payment Required', body: ['0.05 USDC · Base Sepolia', 'TESTNET · price in the 402'], fill: 'cb', via: '↓' },
  { id: 'sign', g: 'x402', x: 812, y: 572, w: 228, h: 80, title: 'Buyer reads the price', body: ['checks its 1 USDC / 24 h cap,', 'then signs'], fill: 'paper', via: '↓' },
  { id: 'facil', g: 'x402', x: 1066, y: 572, w: 228, h: 80, title: 'Facilitator', body: ['verifies the signature'], fill: 'paper', via: '↓' },
  { id: 'ok200', g: 'x402', x: 1320, y: 572, w: 228, h: 80, title: '200 + verdict JSON', body: ['paid 200: pending a CDP key', '0.05 test USDC'], fill: 'paper', dash: true, via: '↓ (dashed: not yet run)' },
];

// pts: polyline in the wide layout; the arrowhead sits on the last point. dash: not yet run.
export const ARROWS = [
  { id: 'a-tab', pts: [[155, 128], [155, 150]] },
  { id: 'a-sta', pts: [[155, 276], [155, 298]] },
  // the fork: analysis.py → trunk → three answers
  { id: 'a-trunk', pts: [[280, 336], [310, 336], [310, 137]], noHead: true },
  { id: 'a-pass', pts: [[310, 137], [338, 137]] },
  { id: 'a-lab', pts: [[310, 237], [338, 237]] },
  { id: 'a-unable', pts: [[310, 337], [338, 337]] },
  // the verdict goes in: three answers merge into one input
  { id: 'a-m1', pts: [[540, 137], [565, 137], [565, 337], [540, 337]], noHead: true },
  { id: 'a-m2', pts: [[540, 237], [565, 237]], noHead: true },
  { id: 'a-verdict', pts: [[565, 240], [638, 240]], label: 'verdict', lx: 602, ly: 231 },
  // four more inputs
  { id: 'a-recall', pts: [[700, 140], [700, 180]] },
  { id: 'a-label', pts: [[930, 140], [930, 180]] },
  { id: 'a-invoice', pts: [[700, 338], [700, 300]] },
  { id: 'a-tap', pts: [[930, 338], [930, 300]] },
  // three outputs
  { id: 'a-rel', pts: [[1010, 240], [1045, 240], [1045, 136], [1078, 136]] },
  { id: 'a-hold', pts: [[1010, 240], [1078, 240]] },
  { id: 'a-esc', pts: [[1045, 240], [1045, 344], [1078, 344]] },
  // into the wallets
  { id: 'a-rel2', pts: [[1290, 136], [1318, 136]] },
  { id: 'a-hold2', pts: [[1290, 240], [1318, 240]] },
  { id: 'a-w1', pts: [[1385, 319], [1385, 267]] },
  { id: 'a-w2', pts: [[1430, 267], [1430, 317]] },
  { id: 'a-w3', pts: [[1395, 215], [1395, 163]] },
  // the x402 lane
  { id: 'x1', pts: [[278, 612], [302, 612]] },
  { id: 'x2', pts: [[532, 612], [556, 612]] },
  { id: 'x3', pts: [[786, 612], [810, 612]] },
  { id: 'x4', pts: [[1040, 612], [1064, 612]] },
  { id: 'x5', pts: [[1294, 612], [1318, 612]], dash: true },
];

// free text: column heads, captions, wallet arrow labels, the lane title and caption
const NOTES = [
  { x: 30, y: 56, t: '1 · MEASURE', head: true },
  { x: 340, y: 56, t: '2 · THREE ANSWERS', head: true },
  { x: 590, y: 56, t: '3 · THE POLICY AGENT', head: true },
  { x: 1320, y: 56, t: '4 · THE MONEY', head: true },
  { x: 1320, y: 76, t: 'Coinbase CDP SDK server wallets', size: 13 },
  { x: 1320, y: 94, t: 'USDC on Base Sepolia (TESTNET)', size: 13 },
  { x: 340, y: 398, t: 'Three answers, never four.', size: 13 },
  { x: 340, y: 416, t: 'No model sets a verdict.', size: 13 },
  { x: 1478, y: 192, t: '↑ release', size: 12 },
  { x: 1478, y: 290, t: '↑ hold, when logged', size: 12 },
  { x: 1478, y: 306, t: '↓ refund', size: 12 },
  { x: 50, y: 556, t: 'Coinbase x402 · CDP server wallets · USDC on Base Sepolia (TESTNET)', size: 16, weight: 600 },
  { x: 1548, y: 556, t: 'modes: cdp · public-facilitator · simulated', size: 12, mono: true, anchor: 'end' },
  { x: 50, y: 680, t: 'Real 402 today; the facilitator’s verify step answered (insufficient_balance on our unfunded test wallet).', size: 13 },
  { x: 50, y: 698, t: 'Selling a verdict over x402 · @x402/express · @x402/evm · CDP SDK', size: 12, mono: true },
];
const LANE = { x: 30, y: 528, w: 1540, h: 184 };

export const GROUPS = [
  { id: 'measure', title: '1 · Measure' },
  { id: 'answers', title: '2 · Three answers', note: 'Three answers, never four. No model sets a verdict.' },
  { id: 'policy', title: '3 · The policy agent', inLabel: 'Five inputs' },
  { id: 'money', title: '4 · The money', sub: 'Coinbase CDP SDK server wallets · USDC on Base Sepolia (TESTNET)', order: ['clinic', 'escrow', 'supplier', 'mode', 'nessie'] },
  { id: 'x402', lane: 'A second lane: how an AI agent pays for a verdict', title: 'Coinbase x402 · CDP server wallets · USDC on Base Sepolia (TESTNET)', sub: 'Real 402 today; the facilitator’s verify step answered (insufficient_balance on our unfunded test wallet). Modes: cdp · public-facilitator · simulated.' },
];

export const MODELS = [
  { model: 'Claude', ids: ['claude-sonnet-5 (station app)', 'claude-sonnet-5-5 (Devpost text)'], does: 'Station: reads the bottle label and imprint, writes the report, answers Ask, behind the guardrail. Clinic: the two-sentence “why”; the escrow clerk (returns the ceiling computed in code, or escalate).', never: 'Sets a verdict; moves money' },
  { model: 'Gemini', ids: [], does: 'Clinic: reads the bottle label into editable fields (unreadable → null); runs the agentic checker (label, up to three cup frames, code tools for the recall lookup).', never: 'Sets a verdict; invents a field' },
  { model: 'Deterministic code', ids: [], does: 'analysis.py and rules.ts (U1 U2 U3 N1 N2 N3 P1) set every verdict; the policy computes the ceiling; the clause filter drops any model sentence with a banned claim word (more than half dropped → rule text instead).', never: 'Calls a model to decide' },
];

/* ---------- wide layout ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function text(x, y, s, { size = 13, weight = 400, mono = false, anchor = 'start', fill = INK, cls = '' } = {}) {
  return `<text x="${x}" y="${y}" font-family='${mono ? MONO : SANS}' font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`;
}
function head(pts) {
  const [a, b] = pts.slice(-2);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l, L = 9, W = 4.5;
  const bx = b[0] - ux * L, by = b[1] - uy * L;
  return `${b[0]},${b[1]} ${(bx - uy * W).toFixed(1)},${(by + ux * W).toFixed(1)} ${(bx + uy * W).toFixed(1)},${(by - ux * W).toFixed(1)}`;
}
// greedy word wrap at an approximate character budget (13 px sans ≈ 6.9 px a character)
function wrap(s, max) {
  const out = [];
  let line = '';
  for (const w of s.split(' ')) {
    if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}

function nodeSvg(n) {
  const r = n.chip ? 20 : 10;
  let s = `<g class="fl-node" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${FILL[n.fill]}" stroke="${INK}" stroke-width="${n.strong ? 2 : 1.3}"${n.dash ? ' stroke-dasharray="6 5"' : ''}/>`;
  const px = n.x + 14;
  let y = n.y + (n.title ? 24 : 17);
  if (n.title) { s += text(px, y, n.title, { size: 15, weight: 600, mono: n.mono }); y += 19; }
  for (const b of n.body) { s += text(px, y, b, { size: n.chip ? 12 : 13, mono: n.chip, fill: INK2 }); y += 17; }
  return s + '</g>';
}

function modelsSvg(y0) {
  const X = [44, 360, 1270], W = 1540;
  let s = `<rect x="30" y="${y0}" width="${W}" height="1" fill="${INK}"/>`;
  s += text(X[0], y0 + 20, 'MODEL', { size: 12, mono: true, weight: 600 }) + text(X[1], y0 + 20, 'DOES', { size: 12, mono: true, weight: 600 }) + text(X[2], y0 + 20, 'NEVER', { size: 12, mono: true, weight: 600 });
  let y = y0 + 30;
  for (const m of MODELS) {
    const left = [m.model, ...m.ids], does = wrap(m.does, 128), never = wrap(m.never, 40);
    const rows = Math.max(left.length, does.length, never.length);
    s += `<rect x="30" y="${y}" width="${W}" height="1" fill="rgba(22,24,27,0.18)"/>`;
    left.forEach((t, i) => { s += text(X[0], y + 18 + i * 17, t, i ? { size: 12, mono: true, fill: INK2 } : { size: 14, weight: 600 }); });
    does.forEach((t, i) => { s += text(X[1], y + 18 + i * 17, t, { size: 13 }); });
    never.forEach((t, i) => { s += text(X[2], y + 18 + i * 17, t, { size: 13 }); });
    y += rows * 17 + 8;
  }
  return { s, bottom: y };
}

export function flowSvg({ standalone = false } = {}) {
  const top = standalone ? 0 : 20; // the inline version drops the title row
  const H = standalone ? 900 : 712;
  let body = '';
  if (standalone) {
    body += `<rect width="1600" height="900" fill="#F5F6F4"/>`;
    body += text(30, 30, 'How Pill moves money and uses models', { size: 18, weight: 700 });
    body += text(1570, 30, 'pill · Cal Hacks 13.0 · every amount is TESTNET or SANDBOX', { size: 12, mono: true, anchor: 'end', fill: INK2 });
  }
  body += `<rect x="${LANE.x}" y="${LANE.y}" width="${LANE.w}" height="${LANE.h}" rx="18" fill="${FILL.cbSoft}" stroke="rgba(22,24,27,0.25)"/>`;
  for (const n of NODES) if (n.svg !== false) body += nodeSvg(n);
  for (const a of ARROWS) {
    const d = 'M' + a.pts.map((p) => p.join(' ')).join(' L');
    body += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"${a.dash ? ' stroke-dasharray="6 5" data-arrow-dash=""' : ' data-arrow=""'}/>`;
    if (!a.noHead) body += `<polygon points="${head(a.pts)}" fill="${INK}" data-head=""/>`;
    if (a.label) body += text(a.lx, a.ly, a.label, { size: 12, mono: true, anchor: 'middle' });
  }
  for (const n of NOTES) body += n.head ? text(n.x, n.y, n.t, { size: 13, mono: true, weight: 600 }) : text(n.x, n.y, n.t, { size: n.size, weight: n.weight || 400, mono: n.mono, anchor: n.anchor });
  let bottom = 0;
  if (standalone) { const m = modelsSvg(718); body += m.s; bottom = m.bottom; }
  const vb = standalone ? '0 0 1600 900' : `0 ${top} 1600 ${H - top}`;
  const size = standalone ? ' width="1600" height="900"' : ' width="100%"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size} class="flow-svg" role="img" aria-labelledby="flow-t"><title id="flow-t">How Pill moves money and uses models: one tablet is measured, deterministic code gives one of three answers, the policy agent turns the answer plus the recall lookup, the bottle label, the invoice cap and the pharmacist's tap into release, hold or escalate, and USDC moves between three Coinbase CDP server wallets on Base Sepolia (TESTNET, simulated until a CDP key). Under it, selling a verdict over Coinbase x402: a real 402 today, the paid 200 pending a CDP key.</title>${body}</svg>`;
  return standalone ? { svg, bottom } : svg;
}

/* ---------- stacked layout (same table, HTML) ---------- */
function card(n) {
  const cls = `fs-card fs-${n.fill || 'paper'}${n.dash ? ' fs-dash' : ''}${n.chip ? ' fs-chipcard' : ''}`;
  return `<div class="${cls}">${n.title ? `<b${n.mono ? ' class="mono"' : ''}>${esc(n.title)}</b>` : ''}${(n.body || []).map((b) => `<span>${esc(b)}</span>`).join('')}</div>`;
}
export function flowStack() {
  return GROUPS.map((g, i) => {
    const ids = g.order || NODES.filter((n) => n.g === g.id).map((n) => n.id);
    const ns = ids.map((id) => NODES.find((n) => n.id === id));
    let html = '', row = [];
    const flush = () => { if (row.length) { html += `<div class="fs-row">${row.join('')}</div>`; row = []; } };
    const chips = ns.filter((n) => n.stack === 'chip');
    if (chips.length) html += `<p class="fs-in">${esc(g.inLabel)}</p><ul class="fs-chips">${chips.map((n) => `<li>${esc(n.title)}${n.body && n.body.length ? ` <small>${esc(n.body.join(' '))}</small>` : ''}</li>`).join('')}</ul>`;
    for (const n of ns) {
      if (n.stack === 'chip') continue;
      if (n.via && !(n.stack === 'row' && row.length)) { flush(); html += `<p class="fs-via">${esc(n.via)}</p>`; }
      if (n.stack === 'row') row.push(card(n)); else { flush(); html += card(n); }
    }
    flush();
    const sep = g.lane ? `<p class="fs-via fs-lane">${esc(g.lane)}</p>` : '<p class="fs-via fs-via--big" aria-hidden="true">↓</p>';
    return (i ? sep : '') + `<section class="fs-group fs-g-${g.id}"><p class="fs-title">${esc(g.title)}</p>${g.sub ? `<p class="fs-sub">${esc(g.sub)}</p>` : ''}${html}${g.note ? `<p class="fs-note">${esc(g.note)}</p>` : ''}</section>`;
  }).join('');
}

export function modelsTable() {
  return `<table class="fl-models"><caption>Who does what, and what they never do</caption><thead><tr><th scope="col">Model</th><th scope="col">Does</th><th scope="col">Never</th></tr></thead><tbody>${MODELS.map((m) => `<tr><th scope="row">${esc(m.model)}${m.ids.map((i) => `<small>${esc(i)}</small>`).join('')}</th><td>${esc(m.does)}</td><td>${esc(m.never)}</td></tr>`).join('')}</tbody></table>`;
}

export function mountFlow(el) {
  el.innerHTML = `<div class="fl-wide">${flowSvg()}</div><div class="fl-stack">${flowStack()}</div>${modelsTable()}<p class="fl-foot">Also as an image: <a href="/diagrams/money-flow.svg" target="_blank" rel="noopener">money-flow.svg</a></p>`;
  return el.querySelector('.flow-svg');
}
