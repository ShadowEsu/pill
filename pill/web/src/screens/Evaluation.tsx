// The evaluation: the verdict on a tinted hero with the gauge, the two numbers that decided it, which channel decided, why,
// what to do next, and a one-line summary to share. Said once, calmly, and read aloud on a tap.
// With VITE_PAY_URL set, Claude writes the why (POST /why, clause-filtered on the service) above the deterministic rule text;
// the answer lives in component state + sessionStorage per run, never in the store.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Action, NavLink, Screen, SrcBadge } from '../components/Shell';
import VerdictCard, { BandBar, Channels, CountUp, SRC_TEXT, STEP, VERDICT_CLASS } from '../components/VerdictCard';
import { VERDICT_FILL } from '../components/PillFill';
import Gauge from '../components/Gauge';
import Curve from '../components/Curve';
import { actions, useStore } from '../lib/store';
import { DRUGS, REFERENCES } from '../data/reference';
import type { Evaluation as Ev, Mode, Run, Verdict } from '../lib/types';
import { PAY_URL, fetchWhy, type Unavailable, type WhyLive, type WhyTemplate } from '../lib/api';
import { playSound, verdictSound } from '../lib/sound';
import ReadAloud from '../components/ReadAloud';
import { ShareSheet } from '../components/ShareCard';

const HERO_TINT: Record<Verdict, string> = { PASS: 'var(--mint-tint)', 'NEEDS LAB': 'var(--amber-tint)', 'UNABLE TO VERIFY': 'var(--grey-tint)' };

const PLAIN: Record<Verdict, string> = {
  PASS: 'This tablet dissolved like the reference tablet did.',
  'NEEDS LAB': 'This tablet did not dissolve like the reference. Ask a pharmacist before taking more.',
  'UNABLE TO VERIFY': 'The box could not measure this one. Try again or ask a pharmacist.',
};
const SHIP: { key: Ev['ship']; word: string }[] = [{ key: 'yes', word: 'release' }, { key: 'hold', word: 'hold' }, { key: 'ask', word: 'escalate' }];

type WhyResult = WhyLive | WhyTemplate | Unavailable;
/** One request per run+mode even under StrictMode's double effects. */
const inflight = new Map<string, Promise<WhyResult>>();

/** Claude's why for this run: null while loading (or without the service). Only live answers are cached for the session. */
function useWhy(run: Run | undefined, mode: Mode, stationRef: string | null, recall: string): WhyResult | null {
  const ev = run?.evaluation ?? null;
  const key = run && ev && PAY_URL ? `pill.why.${run.id}.${mode}` : null;
  const [res, setRes] = useState<{ key: string; r: WhyResult } | null>(() => {
    try { const c = key && sessionStorage.getItem(key); return c && key ? { key, r: JSON.parse(c) as WhyResult } : null; } catch { return null; }
  });
  useEffect(() => {
    if (!key || !run || !ev) return;
    try { const c = sessionStorage.getItem(key); if (c) { setRes({ key, r: JSON.parse(c) as WhyResult }); return; } } catch { /* storage off: just fetch */ }
    let alive = true;
    let p = inflight.get(key);
    if (!p) {
      const ref = ev.rule === 'U1' ? null : REFERENCES[run.drug] ?? REFERENCES[stationRef ?? ''] ?? null;
      p = fetchWhy({
        verdict: ev.verdict, rule: ev.rule, plateau: ev.plateau, band: ref ? [ref.bandLow, ref.bandHigh] : null, glowMin: ref?.glowMin ?? null, scatterMax: ref?.scatterMax ?? null,
        glowRise: ev.glowRise, scatter: ev.scatter, temp: ev.temp, fault: ev.fault, recall, mode,
      });
      inflight.set(key, p);
      void p.finally(() => inflight.delete(key));
    }
    void p.then((r) => {
      if (r.mode === 'live') { try { sessionStorage.setItem(key, JSON.stringify(r)); } catch { /* storage off */ } }
      if (alive) setRes({ key, r });
    });
    return () => { alive = false; };
  }, [key, run, ev, mode, stationRef, recall]);
  return res && res.key === key ? res.r : null;
}

export default function Evaluation() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const mode = useStore((s) => s.mode);
  const stationRef = useStore((s) => s.station.reference);
  const delivery = useStore((s) => s.deliveries.find((d) => d.runId === id));
  const bottle = useStore((s) => s.bottles.find((b) => b.runId === id));
  const [curveOpen, setCurveOpen] = useState(false);
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const ai = useWhy(run, mode === 'personal' ? 'personal' : 'medical', stationRef, bottle?.recall ?? 'unchecked');
  const verdict = run?.evaluation?.verdict ?? null;
  useEffect(() => { if (verdict) playSound(verdictSound(verdict)); }, [id, verdict]);

  if (!run) return (
    <Screen title="No such run" back="/">
      <p className="muted">There is no run {id} on this device.</p>
      <Action><NavLink to="/">Home</NavLink></Action>
    </Screen>
  );
  if (!run.evaluation) return (
    <Screen title="Still running" back="/">
      <p className="muted">Run {id} has not finished, so there is nothing to evaluate yet.</p>
      <Action><NavLink to={`/run/${id}`}>Back to the run</NavLink></Action>
    </Screen>
  );

  const ev = run.evaluation;
  // U1 means nothing was compared; otherwise the run was measured against its drug's band or the station's reference.
  const ref = ev.rule === 'U1' ? null : REFERENCES[run.drug] ?? REFERENCES[stationRef ?? ''] ?? null;
  const drug = DRUGS[run.drug];
  const usedFor = bottle?.usedFor ?? drug?.usedFor ?? 'Ask your pharmacist what this is for.';
  const personal = mode === 'personal';
  const live = ai?.mode === 'live' ? ai : null;
  // Read aloud: the verdict word, then the plain sentence (personal) or the why (medical); Claude's when it answered.
  const spoken = `${ev.verdict}. ${personal ? live?.plain ?? PLAIN[ev.verdict] : live?.why ?? ev.why}`;
  const note = 'Screening result, not a pharmacopeial test. ' + (ref ? `${ref.drug[0].toUpperCase()}${ref.drug.slice(1)} reference, ${ref.runs} runs, CV ${ref.cv} %.` : `No reference for ${drug?.name ?? run.drug} on this station.`);

  const retest = () => {
    const r = actions.startRun({ drug: run.drug, lot: run.lot, src: run.src, bottleId: bottle?.id ?? null, deliveryId: delivery?.id ?? null });
    nav(`/run/${r.id}?replay=B2-07`);
  };
  const save = () => {
    if (bottle) actions.updateBottle(bottle.id, { runId: id, usedFor });
    nav('/medicines');
  };

  const meaning = (
      <section className="card rise stack" style={{ ...STEP(2), gap: 14 }}>
        <p className="eyebrow">what this means</p>
        {personal ? (
          <>
            <p style={{ fontSize: 21, fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{PLAIN[ev.verdict]}</p>
            <div className="stack" style={{ gap: 2 }}>
              <p className="muted" style={{ fontSize: 15 }}>What it's used for</p>
              <p>{usedFor}</p>
            </div>
          </>
        ) : (
          <>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontWeight: 600 }}>Ship</span>
              <div className="row" style={{ gap: 6 }} role="group" aria-label={`Ship: ${ev.ship}`}>
                {SHIP.map((s) => (
                  <span key={s.key} className={'chip' + (s.key === ev.ship ? ' ' + VERDICT_CLASS[ev.verdict] : '')} style={s.key === ev.ship ? { fontWeight: 600 } : { opacity: 0.55 }} aria-current={s.key === ev.ship}>
                    {s.key}
                  </span>
                ))}
              </div>
            </div>
            <dl className="kv">
              <dt>proposes</dt><dd>{SHIP.find((s) => s.key === ev.ship)?.word}</dd>
              <dt>next step</dt><dd>{ev.nextStep}</dd>
            </dl>
            <div className="stack" style={{ gap: 2 }}>
              <p className="muted" style={{ fontSize: 15 }}>What the drug is used for</p>
              <p>{usedFor}</p>
            </div>
            <p className="footnote">Pill only proposes. Money moves on a person's tap.</p>
          </>
        )}
      </section>
  );

  const comparable = !!ref && ev.verdict !== 'UNABLE TO VERIFY';
  const summary = [
    `Pill screening: ${ev.verdict}`,
    `rule ${ev.rule}`,
    comparable ? `${ev.pct} % of reference plateau` : 'not compared to a reference',
    `${drug?.name ?? run.drug} lot ${run.lot}`,
    new Date(run.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    `run ${run.id} (${SRC_TEXT[run.src]})`,
  ].join(' · ') + '. Screening result, not a pharmacopeial test.';
  const [sharing, setSharing] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('copied');
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: summary });
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      setCopied(ok ? 'copied' : 'failed');
    }
  };

  return (
    <Screen eyebrow={`${drug?.name ?? run.drug} · lot ${run.lot}`} title="Evaluation" back="/" right={<SrcBadge src={run.src} />}>
      <div className="wide-2">
        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <section className="card decor-dots" style={{ backgroundColor: HERO_TINT[ev.verdict], borderColor: 'transparent', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <VerdictCard run={run} evaluation={ev} size={104} wordSize={ev.verdict === 'UNABLE TO VERIFY' ? 36 : 44} />
            <div className="rise" style={{ ...STEP(1), flex: '1 1 170px', display: 'flex', justifyContent: 'center' }}>
              <Gauge pct={comparable ? ev.pct : null} low={ref ? Math.round((ref.bandLow / ref.bandMean) * 100) : 87} high={ref ? Math.round((ref.bandHigh / ref.bandMean) * 100) : 113} verdict={ev.verdict} width={300}
                empty={ref ? 'not compared · see why' : 'no reference'} />
            </div>
          </section>
          <section className="card rise" style={{ ...STEP(1), padding: '14px 16px' }} aria-label="Read aloud">
            <ReadAloud text={spoken} label="Read the result aloud" />
          </section>
          {personal && meaning}

          <section className="card tile rise stack" style={{ ...STEP(2), gap: 16, '--tile-accent': VERDICT_FILL[ev.verdict] } as React.CSSProperties}>
            <div className="row between" style={{ alignItems: 'flex-end' }}>
              <div>
                <p className="eyebrow">of reference plateau</p>
                <p className="big-num" style={{ marginTop: 6 }}>{comparable ? <><CountUp value={ev.pct} /><span style={{ fontSize: 30, marginLeft: 4 }}>%</span></> : '—'}</p>
              </div>
              <span className={'chip ' + VERDICT_CLASS[ev.verdict]}>rule {ev.rule}</span>
            </div>
            <hr className="hr" />
            <BandBar label="Dissolved, inline A" value={ev.plateau} max={0.6} low={ref?.bandLow ?? null} high={ref?.bandHigh ?? null}
              text={`plateau ${ev.plateau.toFixed(2)}${ref ? ` · band ${ref.bandLow}–${ref.bandHigh}` : ''}`} />
            <BandBar label="Riboflavin glow, 90°" value={ev.glowRise} max={0.4} low={ref?.glowMin ?? null} high={null}
              text={`glow ${ev.glowRise >= 0 ? '+' : ''}${ev.glowRise.toFixed(2)}${ref ? ` · min ${ref.glowMin}` : ''}`} />
            {!personal && (
              <dl className="kv" style={{ marginTop: 2 }}>
                <dt>scatter, last 30 s</dt><dd>{ev.scatter.toFixed(3)}{ref ? ` · max ${ref.scatterMax}` : ''}</dd>
                <dt>water</dt><dd>{ev.temp.toFixed(1)} °C</dd>
                {ev.fault && <><dt>fault</dt><dd>{ev.fault.replace('_', ' ')}</dd></>}
              </dl>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <section className="card rise stack" style={{ ...STEP(2), gap: 12 }}>
            <p className="eyebrow">why · two channels</p>
            <Channels evaluation={ev} reference={ref} />
            <hr className="hr" />
            {PAY_URL && (
              <div className="stack" style={{ gap: 8 }} aria-live="polite">
                {ai === null
                  ? <div><span className="chip live"><span className="dot" />claude · writing…</span></div>
                  : live
                    ? <>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <span className="chip live" data-why="claude" title={`${live.model_id}; every clause passed the word filter on the service`}><span className="dot" />claude · filtered</span>
                          {live.dropped.length > 0 && <span className="chip warn" title={live.dropped.join(' / ')}><span className="dot" />{live.dropped.length} clause{live.dropped.length > 1 ? 's' : ''} dropped</span>}
                          {live.contradiction && <span className="chip warn"><span className="dot" />inputs disagree</span>}
                        </div>
                        {personal && live.plain && <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.4 }}>{live.plain}</p>}
                        <p style={{ lineHeight: 1.5 }}>{live.why}</p>
                      </>
                    : <div><span className="chip" data-why="unavailable" title={ai.mode === 'template' ? ai.reason : ai.mode === 'unavailable' ? ai.error : undefined}><span className="dot" />claude unavailable · rule text only</span></div>}
              </div>
            )}
            <p className="eyebrow" style={{ marginTop: PAY_URL ? 4 : 0 }}>rule text</p>
            <p style={{ color: 'var(--ink-2)' }}>{ev.why}</p>
          </section>

          {!personal && meaning}

          <section className="stack" style={{ gap: 10 }}>
            <button type="button" className="btn ghost" aria-expanded={curveOpen} onClick={() => setCurveOpen((v) => !v)}>{curveOpen ? 'Hide the curve' : 'See the curve'}</button>
            {curveOpen && <div className="card rise"><Curve samples={run.samples} band={ref} /></div>}
          </section>

          <section className="card stack" style={{ gap: 10, padding: 14 }} aria-label="Share">
            <div className="row between" style={{ gap: 10 }}>
              <span className="eyebrow">share</span>
              <span className="mono muted" style={{ fontSize: 12 }} aria-live="polite">{copied === 'copied' ? 'copied ✓' : copied === 'failed' ? 'select and copy below' : ''}</span>
            </div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', background: 'rgba(22,24,27,.035)', borderRadius: 10, padding: '10px 12px', userSelect: 'all', overflowWrap: 'anywhere' }}>{summary}</p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={copy}>Copy summary</button>
              <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={() => setSharing(true)}>Share card</button>
            </div>
            {sharing && <ShareSheet run={run} onClose={() => setSharing(false)} />}
          </section>
        </div>
      </div>

      <p className="footnote" style={{ textAlign: 'center' }}>{note}</p>

      <Action>
        {personal
          ? <button type="button" className="btn" onClick={save}>Save to My medicines</button>
          : delivery
            ? <button type="button" className="btn" onClick={() => nav(`/delivery/${delivery.id}`)}>Go to delivery</button>
            : <button type="button" className="btn" onClick={() => nav('/')}>Done</button>}
        {ev.verdict === 'UNABLE TO VERIFY' && ev.rule !== 'U1' && <button type="button" className="btn ghost" onClick={retest}>Test again</button>}
      </Action>
    </Screen>
  );
}
