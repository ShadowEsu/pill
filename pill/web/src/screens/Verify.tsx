// x402 pay-per-verdict demo (Coinbase track). The HTTP exchange is simulated; the verdict is computed for real from the B2-07 replay.
import { useEffect, useRef, useState } from 'react';
import { Action, Screen, SrcBadge } from '../components/Shell';
import { curve, evaluate } from '../lib/rules';
import { replayStream } from '../lib/stream';
import { REFERENCES, REPLAYS } from '../data/reference';
import type { Sample, Source } from '../lib/types';

const STEP_MS = 450;
const PAY_TO = '0x9c1f…a4d2';
const TX = '0x3b1d…90ff';

const PREFILL = JSON.stringify({
  drug: 'riboflavin',
  samples: curve(REPLAYS['B2-07'].samples).filter((p) => p.t % 25 === 0).slice(0, 8).map((p) => ({ t: p.t, a: +p.a.toFixed(3), g: +p.g.toFixed(3) })),
});

type Line = { text: string; tone: 'out' | 'in' | 'pay' | 'err' | 'json' };
const TONE: Record<Line['tone'], string> = { out: 'rgba(255,255,255,.92)', in: 'rgba(255,255,255,.92)', pay: '#7FA6FF', err: '#F0A08A', json: 'rgba(255,255,255,.78)' };
const MARK: Record<Line['tone'], string> = { out: '→', in: '←', pay: '◆', err: '✕', json: ' ' };

export default function Verify() {
  const [body, setBody] = useState(PREFILL);
  const [lines, setLines] = useState<Line[]>([]);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done'>('idle');
  const [src, setSrc] = useState<Source | null>(null);
  const timers = useRef<number[]>([]);
  const stopStream = useRef<(() => void) | null>(null);
  const termRef = useRef<HTMLDivElement>(null);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; stopStream.current?.(); stopStream.current = null; };
  useEffect(() => clear, []);
  useEffect(() => { termRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [lines]);

  function send() {
    clear();
    setLines([]);
    setSrc(null);
    setPhase('sending');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = reduced ? 0 : STEP_MS;
    let ok = true;
    try { JSON.parse(body); } catch { ok = false; }
    const bytes = new TextEncoder().encode(body).length;
    const script: Line[] = ok
      ? [
          { text: `POST /verify  content-type: application/json  (${bytes} B)`, tone: 'out' },
          { text: '402 Payment Required', tone: 'in' },
          { text: `  accepts: base-sepolia · USDC · 0.05 · payTo ${PAY_TO}`, tone: 'in' },
          { text: 'wallet signs 0.05 USDC (CDP agent wallet, TESTNET)', tone: 'pay' },
          { text: 'POST /verify  X-PAYMENT: <signed>', tone: 'out' },
          { text: `200 OK · settled tx ${TX}`, tone: 'pay' },
        ]
      : [
          { text: `POST /verify  content-type: application/json  (${bytes} B)`, tone: 'out' },
          { text: '400 Bad Request · body is not JSON · no payment asked', tone: 'err' },
        ];
    script.forEach((l, i) => timers.current.push(window.setTimeout(() => setLines((xs) => [...xs, l]), step * (i + 1))));
    if (!ok) { timers.current.push(window.setTimeout(() => setPhase('done'), step * (script.length + 1))); return; }

    // The verdict: the real rules on the stored B2-07 curve, pulled through the same stream interface the run screen uses.
    const stream = replayStream('B2-07', 1000);
    stopStream.current = stream.stop;
    // Show the verdict once both the scripted exchange has played and the replay has ended.
    let samples: Sample[] | null = null;
    let scriptDone = false;
    let shown = false;
    const showVerdict = () => {
      if (!samples || !scriptDone || shown) return;
      shown = true;
      const ev = evaluate(samples, REFERENCES.riboflavin);
      const ref = REFERENCES.riboflavin;
      const out = { verdict: ev.verdict, rule: ev.rule, pct_of_reference: ev.pct, plateau: ev.plateau, band: [ref.bandLow, ref.bandHigh], glow_rise: ev.glowRise, scatter: ev.scatter, next_step: ev.nextStep, curve: { src: stream.src, lot: 'B2-07', samples: samples.length }, note: 'Screening result, not a pharmacopeial test.' };
      setSrc(stream.src);
      // pretty JSON, but short arrays stay on one line
      const json = JSON.stringify(out, null, 2).replace(/\[\s+([^\]]*?)\s+\]/g, (_, x: string) => `[${x.replace(/\s+/g, ' ')}]`);
      setLines((xs) => [...xs, ...json.split('\n').map((text) => ({ text, tone: 'json' as const }))]);
      setPhase('done');
    };
    stream.onEnd((all) => { samples = [...all]; showVerdict(); });
    timers.current.push(window.setTimeout(() => { scriptDone = true; showVerdict(); }, step * (script.length + 1)));
  }

  function reset() {
    clear();
    setLines([]);
    setSrc(null);
    setBody(PREFILL);
    setPhase('idle');
  }

  return (
    <Screen title="Pay per verdict" eyebrow="Coinbase · x402" back="/" right={<span className="chip"><span className="dot" style={{ background: 'var(--cb)' }} />x402 · TESTNET</span>}>
      <p style={{ color: 'var(--ink-2)', fontSize: 15 }}>Another clinic sends a curve; the service asks for 0.05 USDC before it answers. The verdict comes from the same seven rules the station uses.</p>

      <label className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Request body · curve JSON</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} spellCheck={false} className="mono" style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} disabled={phase === 'sending'} />
      </label>

      {lines.length > 0 && (
        <div ref={termRef} className="card" role="log" aria-label="HTTP exchange" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', padding: '14px 14px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55 }}>
          {lines.map((l, i) => (
            <div key={i} className="rise" style={{ display: 'grid', gridTemplateColumns: '16px 1fr', color: TONE[l.tone], animationDuration: '.3s', scrollMarginBottom: 110 }}>
              <span aria-hidden style={{ color: 'rgba(255,255,255,.45)' }}>{MARK[l.tone]}</span>
              <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.text}</span>
            </div>
          ))}
          {phase === 'sending' && <div aria-hidden style={{ color: 'rgba(255,255,255,.45)', paddingLeft: 16 }}>…</div>}
        </div>
      )}
      {src && <div className="row" style={{ gap: 8 }}><SrcBadge src={src} /><span className="footnote">curve source for this verdict</span></div>}

      <section className="card stack" aria-label="Who pays whom">
        <h2 style={{ fontSize: 17 }}>Who pays whom</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 6, fontSize: 15, color: 'var(--ink-2)' }}>
          <li>The asking clinic's agent wallet pays 0.05 USDC per verdict.</li>
          <li>The Pill verify service receives it at <span className="mono" style={{ fontSize: 13 }}>{PAY_TO}</span>.</li>
          <li>A facilitator checks the signature and settles on Base Sepolia, then the verdict is returned.</li>
        </ol>
        <p className="footnote">Simulated here; the real call needs the CDP key and a facilitator.</p>
      </section>

      <Action>
        {phase === 'done'
          ? <button type="button" className="btn ghost" onClick={reset}>Reset</button>
          : <button type="button" className="btn" onClick={send} disabled={phase === 'sending'}>{phase === 'sending' ? 'Sending…' : 'Send curve'}</button>}
      </Action>
    </Screen>
  );
}
