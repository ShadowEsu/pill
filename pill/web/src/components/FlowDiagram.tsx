// "How Pill moves money and uses models" (pitch/FLOW-SPEC.md, the shared contract; nothing beyond it is claimed here).
// One data table of boxes and arrows drawn as an inline SVG whose words stay text: the tree (Measure → three answers →
// the policy agent with its five inputs and three outputs → the money on Coinbase CDP server wallets, Nessie beside it),
// the x402 lane under it (the paid 200 stays dashed until one really arrives), and the models table beneath.
// `active` lights boxes and arrows (a Coinbase-blue fill, never red); an arrow lights when its id is listed, or when both
// its ends are lit (unless it is `explicit`). `compact` draws only the policy agent and the money column.
// Phones scroll the diagram sideways (a hint says so); reduced motion keeps it static.
import { useId, type CSSProperties } from 'react';
import './flow.css';

type Group = 'measure' | 'answers' | 'policy' | 'money' | 'lane';
type Tone = 'plain' | 'pass' | 'lab' | 'unable' | 'hold' | 'note' | 'chip';
interface Box { id: string; group: Group; x: number; y: number; w: number; h: number; title: string; sub?: string; tone?: Tone; mono?: boolean; small?: boolean }
interface Arrow { from: string; to: string; label?: string; shift?: number; pending?: string; explicit?: boolean; link?: boolean; elbow?: boolean; labelAt?: [number, number, 'start' | 'middle' | 'end'] }

const W = 1180, H = 590;
const LANE_X = (i: number) => 12 + i * (168 + 29.6);

/** Every box in the diagram (FLOW-SPEC.md, word for word where it gives the words). */
export const FLOW_BOXES: Box[] = [
  // 1 · Measure
  { id: 'tablet', group: 'measure', x: 12, y: 36, w: 200, h: 40, title: 'One tablet' },
  { id: 'station', group: 'measure', x: 12, y: 100, w: 200, h: 104, title: 'Station', sub: 'UNO Q: blue · white · red LEDs, 2 photoresistors, 1 CSV line/s; the firmware decides nothing' },
  { id: 'analysis', group: 'measure', x: 12, y: 228, w: 200, h: 66, title: 'analysis.py', sub: 'deterministic: curve maths, quality gates', mono: true },
  // 2 · Three answers
  { id: 'pass', group: 'answers', x: 252, y: 112, w: 172, h: 40, title: 'Passed the screen', tone: 'pass' },
  { id: 'lab', group: 'answers', x: 252, y: 168, w: 172, h: 40, title: 'Needs lab testing', tone: 'lab' },
  { id: 'unable', group: 'answers', x: 252, y: 224, w: 172, h: 40, title: 'Unable to verify', tone: 'unable' },
  { id: 'fork-note', group: 'answers', x: 252, y: 284, w: 172, h: 50, title: '', sub: 'Three answers, never four. No model sets a verdict.', tone: 'note' },
  // 3 · The policy agent: five inputs, one box, three outputs
  { id: 'verdict-note', group: 'policy', x: 426, y: 98, w: 44, h: 30, title: '', sub: 'the verdict', tone: 'note' },
  { id: 'recall', group: 'policy', x: 470, y: 28, w: 88, h: 110, title: 'Recall lookup', sub: 'openFDA', small: true },
  { id: 'label', group: 'policy', x: 560.67, y: 28, w: 88, h: 110, title: 'Bottle label', sub: 'Gemini → editable fields; unreadable = null', small: true },
  { id: 'amount', group: 'policy', x: 651.33, y: 28, w: 88, h: 110, title: 'Invoice amount', sub: 'vs cap', small: true },
  { id: 'tap', group: 'policy', x: 742, y: 28, w: 88, h: 110, title: "Pharmacist's tap", small: true },
  { id: 'policy', group: 'policy', x: 470, y: 150, w: 360, h: 96, title: 'Policy agent · clinic app (pill/pay)', sub: 'Six clauses P1–P6, in code → a ceiling. Claude may only return the ceiling or escalate.' },
  { id: 'escalate', group: 'policy', x: 470, y: 290, w: 112, h: 104, title: 'Escalate', sub: 'Unable to verify → to a person; nothing moves' },
  { id: 'hold', group: 'policy', x: 594, y: 290, w: 112, h: 104, title: 'Hold', sub: 'Needs lab → hold + lab referral draft', tone: 'hold' },
  { id: 'release', group: 'policy', x: 718, y: 290, w: 112, h: 104, title: 'Release', sub: 'Passed + no recall + amount within cap + tap → escrow → supplier' },
  // 4 · The money (Coinbase)
  { id: 'clinic', group: 'money', x: 880, y: 36, w: 170, h: 44, title: 'pill-clinic', sub: 'CDP server wallet', mono: true },
  { id: 'escrow', group: 'money', x: 880, y: 136, w: 170, h: 44, title: 'pill-escrow', sub: 'CDP server wallet', mono: true },
  { id: 'supplier', group: 'money', x: 880, y: 236, w: 170, h: 44, title: 'pill-supplier', sub: 'CDP server wallet', mono: true },
  { id: 'nessie', group: 'money', x: 1070, y: 116, w: 98, h: 116, title: 'Nessie', sub: 'Capital One mirrors every move in sandbox dollars (SANDBOX)' },
  { id: 'usdc-note', group: 'money', x: 880, y: 296, w: 288, h: 36, title: '', sub: 'USDC on Base Sepolia (TESTNET) · Coinbase CDP SDK server wallets', tone: 'note' },
  { id: 'escrow-mode', group: 'money', x: 880, y: 338, w: 288, h: 40, title: '', sub: 'escrow moves: mode: simulated until a CDP key', tone: 'chip', mono: true },
  // the second lane: selling a verdict over x402
  { id: 'buyer', group: 'lane', x: LANE_X(0), y: 448, w: 168, h: 96, title: 'Buyer agent', sub: 'another clinic, or an agent with no local reference' },
  { id: 'post', group: 'lane', x: LANE_X(1), y: 448, w: 168, h: 96, title: 'POST /verify', sub: 'with a curve', mono: true },
  { id: 'p402', group: 'lane', x: LANE_X(2), y: 448, w: 168, h: 96, title: '402 Payment Required', sub: '0.05 USDC, Base Sepolia TESTNET; the price travels in the 402' },
  { id: 'sign', group: 'lane', x: LANE_X(3), y: 448, w: 168, h: 96, title: 'Buyer signs', sub: 'reads the price, checks its 1 USDC / 24 h cap, signs' },
  { id: 'facilitator', group: 'lane', x: LANE_X(4), y: 448, w: 168, h: 96, title: 'Facilitator', sub: 'verifies the signature' },
  { id: 'ok200', group: 'lane', x: LANE_X(5), y: 448, w: 168, h: 96, title: '200 + verdict JSON' },
];

/** Every arrow. `pending`: drawn dashed with that label until the arrow is lit by something that really happened. */
export const FLOW_ARROWS: Arrow[] = [
  { from: 'tablet', to: 'station' },
  { from: 'station', to: 'analysis' },
  { from: 'analysis', to: 'pass', elbow: true }, { from: 'analysis', to: 'lab', elbow: true }, { from: 'analysis', to: 'unable', elbow: true },
  { from: 'pass', to: 'policy', elbow: true }, { from: 'lab', to: 'policy', elbow: true }, { from: 'unable', to: 'policy', elbow: true },
  { from: 'recall', to: 'policy' }, { from: 'label', to: 'policy' }, { from: 'amount', to: 'policy' }, { from: 'tap', to: 'policy' },
  { from: 'policy', to: 'escalate' }, { from: 'policy', to: 'hold' }, { from: 'policy', to: 'release' },
  { from: 'release', to: 'supplier' },
  { from: 'clinic', to: 'escrow', shift: -55, label: 'hold: when the delivery is logged' },
  { from: 'escrow', to: 'clinic', shift: 75, label: 'refund', explicit: true },
  { from: 'escrow', to: 'supplier', label: 'release' },
  { from: 'escrow', to: 'nessie', link: true },
  { from: 'buyer', to: 'post' }, { from: 'post', to: 'p402' }, { from: 'p402', to: 'sign' }, { from: 'sign', to: 'facilitator' },
  { from: 'facilitator', to: 'ok200', pending: 'paid 200: pending a CDP key / 0.05 test USDC', labelAt: [LANE_X(5) - 14.8, 566, 'middle'] },
];

const HEADS: { x: number; group: Group; text: string }[] = [
  { x: 12, group: 'measure', text: '1 · Measure' },
  { x: 252, group: 'answers', text: '2 · Three answers' },
  { x: 470, group: 'policy', text: '3 · The policy agent' },
  { x: 880, group: 'money', text: '4 · The money (Coinbase)' },
  { x: 12, group: 'lane', text: 'Selling a verdict over x402 (Coinbase x402)' },
];

/** Who does what, and what they never do (FLOW-SPEC.md, the models row). */
export const MODELS: { who: string; note: string; does: string; never: string }[] = [
  { who: 'Claude', note: 'claude-sonnet-5', does: 'Station: reads the bottle label and imprint, writes the report, answers Ask, behind the guardrail. Clinic: the two-sentence "why"; the escrow clerk (returns the ceiling computed in code, or escalate).', never: 'Sets a verdict; moves money' },
  { who: 'Gemini', note: 'clinic app', does: 'Reads the bottle label into editable fields (unreadable → null); runs the agentic checker (label, up to three cup frames, code tools for the recall lookup).', never: 'Sets a verdict; invents a field' },
  { who: 'Deterministic code', note: 'analysis.py · rules.ts · policy', does: 'analysis.py and rules.ts (U1 U2 U3 N1 N2 N3 P1) set every verdict; policy computes the ceiling; the clause filter drops any model sentence with a banned claim word (more than half dropped → rule text instead).', never: 'Calls a model to decide' },
];

/** Greedy word wrap for SVG text at an average glyph width of 0.56 em (0.6 em for mono). */
function wrap(text: string, px: number, size: number, mono = false) {
  const max = Math.max(4, Math.floor(px / (size * (mono ? 0.6 : 0.56))));
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

const cy = (b: Box) => b.y + b.h / 2;

/** An orthogonal route between two boxes: straight when they overlap on one axis, else one elbow. */
function route(a: Box, b: Box, shift = 0, elbow = false): { d: string; mid: [number, number] } {
  const lo = Math.max(a.x, b.x), hi = Math.min(a.x + a.w, b.x + b.w);
  if (elbow) {
    const x1 = a.x + a.w, x2 = b.x, mx = (x1 + x2) / 2;
    return { d: `M${x1} ${cy(a)} H${mx} V${cy(b)} H${x2}`, mid: [mx, (cy(a) + cy(b)) / 2] };
  }
  if (hi - lo > 12 && (b.y >= a.y + a.h || a.y >= b.y + b.h)) {
    const x = (lo + hi) / 2 + shift;
    const down = b.y >= a.y + a.h;
    const y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
    return { d: `M${x} ${y1} V${y2}`, mid: [x, (y1 + y2) / 2] };
  }
  const right = b.x >= a.x + a.w;
  const x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
  const tlo = Math.max(a.y, b.y), thi = Math.min(a.y + a.h, b.y + b.h);
  if (thi - tlo > 12) { const y = (tlo + thi) / 2 + shift; return { d: `M${x1} ${y} H${x2}`, mid: [(x1 + x2) / 2, y] }; }
  const mx = (x1 + x2) / 2;
  return { d: `M${x1} ${cy(a)} H${mx} V${cy(b)} H${x2}`, mid: [mx, (cy(a) + cy(b)) / 2] };
}

const id = (a: Arrow) => `${a.from}>${a.to}`;

/** Lit ids for a delivery's outcome (Pay, Delivery): the policy agent's output and where the money sits. */
export function deliveryPath(outcome: 'pending' | 'release' | 'hold' | 'escalate' | 'released'): string[] {
  if (outcome === 'released') return ['tap', 'policy', 'release', 'clinic', 'escrow', 'supplier', 'clinic>escrow', 'escrow>supplier'];
  if (outcome === 'release') return ['policy', 'release', 'clinic', 'escrow', 'clinic>escrow'];
  if (outcome === 'hold') return ['policy', 'hold', 'clinic', 'escrow', 'clinic>escrow'];
  if (outcome === 'escalate') return ['policy', 'escalate', 'clinic', 'escrow', 'clinic>escrow'];
  return ['clinic', 'escrow', 'clinic>escrow'];
}

export default function FlowDiagram({ active = [], compact = false, label = 'How Pill moves money and uses models' }: { active?: string[]; compact?: boolean; label?: string }) {
  const on = new Set(active);
  const shown = (g: Group) => !compact || g === 'policy' || g === 'money';
  const boxes = FLOW_BOXES.filter((b) => shown(b.group) && !(compact && b.id === 'verdict-note'));
  const byId = (k: string) => boxes.find((b) => b.id === k);
  const arrows = FLOW_ARROWS.filter((a) => byId(a.from) && byId(a.to));
  const lit = (a: Arrow) => on.has(id(a)) || (!a.explicit && on.has(a.from) && on.has(a.to));
  const vb = compact ? '456 0 724 400' : `0 0 ${W} ${H}`;
  const uid = 'flow' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const paid200 = arrows.some((a) => a.pending && lit(a));
  // phones scroll sideways at this width; from 900 px up the diagram scales to fit its card (flow.css)
  const minW = compact ? 700 : 1080;

  return (
    <figure className={'flow' + (compact ? ' compact' : '')} aria-label={label}>
      <div className="flow-chips">
        <span className="chip"><span className="dot" style={{ background: 'var(--cb)' }} />Coinbase x402</span>
        <span className="chip"><span className="dot" style={{ background: 'var(--cb)' }} />CDP SDK</span>
        <span className="chip"><span className="dot" />TESTNET</span>
        <span className="chip"><span className="dot" />SANDBOX</span>
      </div>
      <p className="flow-hint" aria-hidden="true">Swipe sideways to follow the arrows →</p>
      <div className="flow-scroll" tabIndex={0} role="region" aria-label={`${label}, scrollable`}>
        <svg viewBox={vb} style={{ '--flow-min': `${minW}px` } as CSSProperties} role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>{label}</title>
          <defs>
            <marker id={`${uid}-h`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" /></marker>
            <marker id={`${uid}-hon`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--cb)" /></marker>
          </defs>
          {HEADS.filter((h) => shown(h.group)).map((h) => (
            <text key={h.text} x={h.x} y={h.group === 'lane' ? 432 : 20} className="flow-head">{h.text}</text>
          ))}
          {arrows.map((a) => {
            const r = route(byId(a.from)!, byId(a.to)!, a.shift, a.elbow);
            const isOn = lit(a);
            const dashed = !!a.pending && !isOn;
            const text = a.pending ? (isOn ? 'paid 200 arrived' : a.pending) : a.label;
            const [lx, ly, anchor] = a.labelAt ?? [r.mid[0] + 6, r.mid[1] + 4, 'start' as const];
            return (
              <g key={id(a)} className={'flow-arrow' + (isOn ? ' on' : '') + (dashed ? ' pending' : '') + (a.link ? ' link' : '')} data-arrow={id(a)}>
                <path d={r.d} markerEnd={a.link ? undefined : `url(#${uid}-${isOn ? 'hon' : 'h'})`} />
                {text && wrap(text, a.labelAt ? 230 : 120, 10.5).map((l, i) => <text key={i} x={lx} y={ly + i * 12.5} textAnchor={anchor} className="flow-alabel">{l}</text>)}
              </g>
            );
          })}
          {boxes.map((b) => {
            const isOn = on.has(b.id);
            const tone = b.tone ?? 'plain';
            if (tone === 'note') {
              return <text key={b.id} className="flow-note" data-node={b.id}>{wrap(b.sub ?? '', b.w, 11).map((l, i) => <tspan key={i} x={b.x} y={b.y + 12 + i * 14}>{l}</tspan>)}</text>;
            }
            // small boxes (the policy agent's inputs): 11.5 / 10 px text, 6 px padding
            const [ts, ss, pad] = b.small ? [11.5, 10, 6] : [13, tone === 'chip' ? 10.5 : 11, 8];
            const titleLines = b.title ? wrap(b.title, b.w - pad * 2, ts, b.mono) : [];
            const subLines = b.sub ? wrap(b.sub, b.w - pad * 2, ss, tone === 'chip') : [];
            const tl = ts + 2, sl = ss + 2;
            return (
              <g key={b.id} className={`flow-box t-${tone}${isOn ? ' on' : ''}`} data-node={b.id} data-on={isOn || undefined}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={tone === 'chip' ? b.h / 2 : 10} />
                {titleLines.map((l, i) => <text key={'t' + i} x={b.x + pad} y={b.y + 18 + i * tl} className={'flow-title' + (b.mono ? ' mono' : '')} style={{ fontSize: ts }}>{l}</text>)}
                {subLines.map((l, i) => <text key={'s' + i} x={tone === 'chip' ? b.x + 14 : b.x + pad} y={tone === 'chip' ? b.y + 16 + i * 13 : b.y + 18 + titleLines.length * tl + i * sl} className={'flow-sub' + (tone === 'chip' ? ' mono' : '')} style={{ fontSize: ss }}>{l}</text>)}
              </g>
            );
          })}
        </svg>
      </div>
      {!compact && (
        <>
          <figcaption className="flow-caption">
            <p>Real 402 today; the facilitator's verify step answered (<code>insufficient_balance</code> on our unfunded test wallet). {paid200 ? 'A paid 200 arrived during this call.' : 'The dashed arrow has not run yet.'}</p>
            <p className="mono">@x402/express · @x402/evm · CDP SDK · service modes: cdp · public-facilitator · simulated, each named in every response</p>
          <div className="flow-models" role="region" aria-label="Who does what">
            <table>
              <thead><tr><th scope="col">Model</th><th scope="col">Does</th><th scope="col">Never</th></tr></thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m.who}><th scope="row">{m.who}<span>{m.note}</span></th><td>{m.does}</td><td className="never">{m.never}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          </figcaption>
        </>
      )}
    </figure>
  );
}
