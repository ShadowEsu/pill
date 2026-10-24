// x402 pay-per-verdict (Coinbase track).
// With VITE_PAY_URL set: a real POST to the pill-pay service, the real 402 decoded from PAYMENT-REQUIRED, then the CLI pays
// (the browser holds no wallet) while this screen polls GET /health. Without it: the v1 simulation, labelled SIMULATED.
import { useEffect, useRef, useState } from 'react';
import { Action, Screen, SrcBadge } from '../components/Shell';
import { curve, evaluate } from '../lib/rules';
import { replayStream } from '../lib/stream';
import { REFERENCES, REPLAYS } from '../data/reference';
import type { Sample, Source } from '../lib/types';

const PAY_URL = (import.meta.env.VITE_PAY_URL as string | undefined)?.replace(/\/$/, '') || null;
const STEP_MS = 450;
const SIM_PAY_TO = '0x9c1f…a4d2';
const SIM_TX = '0x3b1d…90ff';
const HEALTH_MS = 5000;

const PREFILL = JSON.stringify({
  drug: 'riboflavin',
  samples: curve(REPLAYS['B2-07'].samples).filter((p) => p.t % 25 === 0).slice(0, 8).map((p) => ({ t: p.t, a: +p.a.toFixed(3), g: +p.g.toFixed(3) })),
});

type Line = { text: string; tone: 'out' | 'in' | 'pay' | 'err' | 'json' };
const TONE: Record<Line['tone'], string> = { out: 'rgba(255,255,255,.92)', in: 'rgba(255,255,255,.92)', pay: '#7FA6FF', err: '#F0A08A', json: 'rgba(255,255,255,.78)' };
const MARK: Record<Line['tone'], string> = { out: '→', in: '←', pay: '◆', err: '✕', json: ' ' };

/** What the service says about itself (GET /health). */
type Health = { mode: 'cdp' | 'public-facilitator' | 'simulated'; facilitator: string; network: string; payTo: string; escrow?: string };
type Accept = { scheme: string; network: string; amount: string; asset: string; payTo: string; extra?: Record<string, unknown> };

/** Pretty JSON, but short arrays stay on one line. */
const jsonLines = (v: unknown): Line[] => JSON.stringify(v, null, 2).replace(/\[\s+([^\]]*?)\s+\]/g, (_, x: string) => `[${x.replace(/\s+/g, ' ')}]`).split('\n').map((text) => ({ text, tone: 'json' as const }));
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export default function Verify() {
  const [body, setBody] = useState(PREFILL);
  const [lines, setLines] = useState<Line[]>([]);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done'>('idle');
  const [src, setSrc] = useState<Source | null>(null);
  // Live mode only: the mode the service reported, the 402's first option, and the last health poll.
  const [svcMode, setSvcMode] = useState<Health['mode'] | null>(null);
  const [accept, setAccept] = useState<Accept | null>(null);
  const [health, setHealth] = useState<{ at: number; h: Health | null } | null>(null);
  const timers = useRef<number[]>([]);
  const stopStream = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const termRef = useRef<HTMLDivElement>(null);

  const clear = () => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.current = []; stopStream.current?.(); stopStream.current = null; abort.current?.abort(); abort.current = null; };
  useEffect(() => clear, []);
  useEffect(() => { termRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [lines]);

  async function sendLive(url: string) {
    const ctl = new AbortController();
    abort.current = ctl;
    const push = (...ls: Line[]) => setLines((xs) => [...xs, ...ls]);
    const bytes = new TextEncoder().encode(body).length;
    push({ text: `POST ${url}/verify  content-type: application/json  (${bytes} B)`, tone: 'out' });
    let res: Response;
    try {
      res = await fetch(`${url}/verify`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body, signal: ctl.signal });
    } catch (e) {
      if (ctl.signal.aborted) return;
      push({ text: `no answer from ${url} (${(e as Error).message}). Start it: cd pill/pay && npm run serve`, tone: 'err' });
      setPhase('done');
      return;
    }
    const mode = res.headers.get('x-pill-mode') as Health['mode'] | null;
    setSvcMode(mode);
    const resBody = await res.json().catch(() => null);
    if (res.status === 402) {
      const header = res.headers.get('payment-required');
      if (!header) { push({ text: '402 without a PAYMENT-REQUIRED header (is CORS exposing it?)', tone: 'err' }); setPhase('done'); return; }
      const required = JSON.parse(atob(header)) as { x402Version: number; error?: string; accepts: Accept[] };
      const a = required.accepts[0];
      setAccept(a);
      push(
        { text: `402 Payment Required · mode ${mode ?? 'unknown'}`, tone: 'in' },
        { text: `  accepts: ${a.network} · USDC ${(Number(a.amount) / 1e6).toFixed(2)} (TESTNET) · payTo ${short(a.payTo)}`, tone: 'in' },
        { text: '  PAYMENT-REQUIRED, decoded:', tone: 'in' },
        ...jsonLines(required),
        { text: 'this browser holds no wallet, so it does not pay', tone: 'pay' },
        { text: `pay with:  cd pill/pay && npm run buy -- --url ${url}/verify --curve B2-07`, tone: 'pay' },
        { text: `watching GET ${url}/health every ${HEALTH_MS / 1000} s`, tone: 'out' },
      );
      const poll = async () => {
        try {
          const h = (await (await fetch(`${url}/health`, { signal: ctl.signal })).json()) as Health;
          setHealth({ at: Date.now(), h });
          setSvcMode(h.mode);
        } catch { if (!ctl.signal.aborted) setHealth({ at: Date.now(), h: null }); }
      };
      void poll();
      timers.current.push(window.setInterval(poll, HEALTH_MS));
    } else if (res.ok && resBody) {
      push({ text: `${res.status} OK · mode ${mode ?? 'unknown'}`, tone: 'pay' }, ...jsonLines(resBody));
    } else {
      push({ text: `${res.status} · ${(resBody as { error?: string } | null)?.error ?? res.statusText}`, tone: 'err' });
    }
    setPhase('done');
  }

  function sendSimulated() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = reduced ? 0 : STEP_MS;
    let ok = true;
    try { JSON.parse(body); } catch { ok = false; }
    const bytes = new TextEncoder().encode(body).length;
    const script: Line[] = ok
      ? [
          { text: `POST /verify  content-type: application/json  (${bytes} B)`, tone: 'out' },
          { text: '402 Payment Required', tone: 'in' },
          { text: `  accepts: base-sepolia · USDC · 0.05 · payTo ${SIM_PAY_TO}`, tone: 'in' },
          { text: 'wallet signs 0.05 USDC (CDP agent wallet, TESTNET)', tone: 'pay' },
          { text: 'POST /verify  X-PAYMENT: <signed>', tone: 'out' },
          { text: `200 OK · settled tx ${SIM_TX}`, tone: 'pay' },
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
      setLines((xs) => [...xs, ...jsonLines(out)]);
      setPhase('done');
    };
    stream.onEnd((all) => { samples = [...all]; showVerdict(); });
    timers.current.push(window.setTimeout(() => { scriptDone = true; showVerdict(); }, step * (script.length + 1)));
  }

  function send() {
    clear();
    setLines([]);
    setSrc(null);
    setAccept(null);
    setHealth(null);
    setPhase('sending');
    if (PAY_URL) void sendLive(PAY_URL);
    else sendSimulated();
  }

  function reset() {
    clear();
    setLines([]);
    setSrc(null);
    setAccept(null);
    setHealth(null);
    setSvcMode(null);
    setBody(PREFILL);
    setPhase('idle');
  }

  const simulated = !PAY_URL || svcMode === 'simulated';
  const termLabel = !PAY_URL ? 'SIMULATED · no VITE_PAY_URL, nothing leaves this page' : svcMode === 'simulated' ? `SIMULATED · ${PAY_URL} has no facilitator` : `LIVE · ${PAY_URL}${svcMode ? ` · ${svcMode}` : ''}`;
  const payTo = accept ? short(accept.payTo) : PAY_URL ? 'the address in the 402' : SIM_PAY_TO;

  return (
    <Screen title="Pay per verdict" eyebrow="Coinbase · x402" back="/" right={<span className="chip"><span className="dot" style={{ background: 'var(--cb)' }} />x402 · TESTNET</span>}>
      <p style={{ color: 'var(--ink-2)', fontSize: 15 }}>Another clinic sends a curve; the service asks for 0.05 USDC before it answers. The verdict comes from the same seven rules the station uses.</p>

      <label className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Request body · curve JSON</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} spellCheck={false} className="mono" style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} disabled={phase === 'sending'} />
      </label>

      {lines.length > 0 && (
        <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', padding: '12px 14px 14px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', alignItems: 'baseline', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: simulated ? 'rgba(255,255,255,.45)' : '#7FA6FF', alignSelf: 'start', marginTop: 5 }} />
            <span style={{ color: simulated ? 'rgba(255,255,255,.7)' : '#7FA6FF', letterSpacing: '.04em', overflowWrap: 'anywhere' }}>{termLabel}</span>
          </div>
          <div ref={termRef} role="log" aria-label="HTTP exchange">
            {lines.map((l, i) => (
              <div key={i} className="rise" style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', color: TONE[l.tone], animationDuration: '.3s', scrollMarginBottom: 110 }}>
                <span aria-hidden style={{ color: 'rgba(255,255,255,.45)' }}>{MARK[l.tone]}</span>
                <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.text}</span>
              </div>
            ))}
            {(phase === 'sending' || (PAY_URL && health)) && (
              <div aria-live="polite" style={{ color: 'rgba(255,255,255,.55)', paddingLeft: 16 }}>
                {phase === 'sending' ? '…' : health?.h ? `health ${new Date(health.at).toLocaleTimeString()} · mode ${health.h.mode} · escrow ${health.h.escrow ?? '?'} · facilitator ${health.h.facilitator}` : `health ${new Date(health!.at).toLocaleTimeString()} · no answer`}
              </div>
            )}
          </div>
        </div>
      )}
      {src && <div className="row" style={{ gap: 8 }}><SrcBadge src={src} /><span className="footnote">curve source for this verdict</span></div>}

      <section className="card stack" aria-label="Who pays whom">
        <h2 style={{ fontSize: 17 }}>Who pays whom</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 6, fontSize: 15, color: 'var(--ink-2)' }}>
          <li>The asking clinic's agent wallet pays 0.05 USDC per verdict, under a 1 USDC daily cap.</li>
          <li>The Pill verify service receives it at <span className="mono" style={{ fontSize: 13 }}>{payTo}</span>.</li>
          <li>A facilitator checks the signature and settles on Base Sepolia, then the verdict is returned.</li>
        </ol>
        <p className="footnote">
          {!PAY_URL
            ? 'Simulated here: set VITE_PAY_URL to the pill-pay service to see its real 402.'
            : svcMode === 'simulated'
              ? 'The service runs in simulated mode: its 402 is real-shaped, but no facilitator settles anything.'
              : 'Live: the 402 comes from the pill-pay service. The browser has no wallet, so the payment runs from the command line.'}
        </p>
      </section>

      <Action>
        {phase === 'done'
          ? <button type="button" className="btn ghost" onClick={reset}>Reset</button>
          : <button type="button" className="btn" onClick={send} disabled={phase === 'sending'}>{phase === 'sending' ? 'Sending…' : 'Send curve'}</button>}
      </Action>
    </Screen>
  );
}
