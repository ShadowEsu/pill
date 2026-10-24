// The evaluation: the verdict, the two numbers that decided it, why, and what to do next. Said once, calmly.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Action, NavLink, Screen, SrcBadge } from '../components/Shell';
import VerdictCard, { BandBar, CountUp, STEP, VERDICT_CLASS } from '../components/VerdictCard';
import Curve from '../components/Curve';
import { actions, useStore } from '../lib/store';
import { DRUGS, REFERENCES } from '../data/reference';
import type { Evaluation as Ev, Verdict } from '../lib/types';

const PLAIN: Record<Verdict, string> = {
  PASS: 'This tablet dissolved like the reference tablet did.',
  'NEEDS LAB': 'This tablet did not dissolve like the reference. Ask a pharmacist before taking more.',
  'UNABLE TO VERIFY': 'The box could not measure this one. Try again or ask a pharmacist.',
};
const SHIP: { key: Ev['ship']; word: string }[] = [{ key: 'yes', word: 'release' }, { key: 'hold', word: 'hold' }, { key: 'ask', word: 'escalate' }];

export default function Evaluation() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const mode = useStore((s) => s.mode);
  const stationRef = useStore((s) => s.station.reference);
  const delivery = useStore((s) => s.deliveries.find((d) => d.runId === id));
  const bottle = useStore((s) => s.bottles.find((b) => b.runId === id));
  const [curveOpen, setCurveOpen] = useState(false);

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

  return (
    <Screen eyebrow={`${drug?.name ?? run.drug} · lot ${run.lot}`} title="Evaluation" back="/" right={<SrcBadge src={run.src} />}>
      <VerdictCard run={run} evaluation={ev} />
      {personal && meaning}

      <section className="card rise stack" style={{ ...STEP(2), gap: 16 }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <p className="eyebrow">of reference plateau</p>
            <p className="big-num" style={{ marginTop: 6 }}>{ref && ev.verdict !== 'UNABLE TO VERIFY' ? <><CountUp value={ev.pct} /><span style={{ fontSize: 30, marginLeft: 4 }}>%</span></> : '—'}</p>
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

      <section className="rise stack" style={{ ...STEP(2), gap: 6 }}>
        <p className="eyebrow">why</p>
        <p style={{ color: 'var(--ink-2)' }}>{ev.why}</p>
      </section>

      {!personal && meaning}

      <section className="stack" style={{ gap: 10 }}>
        <button type="button" className="btn ghost" aria-expanded={curveOpen} onClick={() => setCurveOpen((v) => !v)}>{curveOpen ? 'Hide the curve' : 'See the curve'}</button>
        {curveOpen && <div className="card rise"><Curve samples={run.samples} band={ref} /></div>}
      </section>

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
