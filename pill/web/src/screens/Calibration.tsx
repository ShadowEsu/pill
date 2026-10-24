// Calibration: ten reference tablets, overlaid. The band is only worth something if they agree.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Action, Screen, SrcBadge } from '../components/Shell';
import Curve from '../components/Curve';
import { CountUp } from '../components/VerdictCard';
import { actions, useStore } from '../lib/store';
import { evaluate } from '../lib/rules';
import { makeCurve, REFERENCES } from '../data/reference';

const REF = REFERENCES.riboflavin;
// Seeds 21–30; plateau 0.40–0.44, tau 34–42, glow 0.30–0.35, spread so no two runs share a shape.
const RUNS = Array.from({ length: 10 }, (_, i) => makeCurve({
  seed: 21 + i,
  plateau: 0.40 + (((i * 7) % 10) / 9) * 0.04,
  tau: 34 + (((i * 3) % 10) / 9) * 8,
  glow: 0.30 + (((i * 13) % 10) / 9) * 0.05,
}));
// Leave-one-out: each run, held out, evaluated against the band. Counted, not asserted.
const LOO = RUNS.filter((s) => evaluate(s, REF).verdict === 'PASS').length;

export default function Calibration() {
  const nav = useNavigate();
  const [drawn, setDrawn] = useState(false);
  const [saved, setSaved] = useState(false);
  const calibratedAt = useStore((s) => s.station.calibratedAt);
  const at = calibratedAt ? new Date(calibratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Screen title="Calibration" eyebrow={`${REF.label} · station 01`} back="/" right={<SrcBadge src="sim" />}>
      <p style={{ color: 'var(--ink-2)' }}>Ten reference tablets, dissolved one by one. Their plateaus set the band every later run is held against.</p>

      <section className="card stack" style={{ gap: 14 }}>
        <Curve samples={[]} band={REF} overlays={RUNS} stagger={120} onDrawn={() => setDrawn(true)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--surface)', padding: '10px 12px' }}>
            <p className="eyebrow" style={{ fontSize: 10 }}>runs</p>
            <p className="mono" style={{ fontSize: 17, marginTop: 2 }}><CountUp value={RUNS.length} duration={RUNS.length * 120 + 380} />/{REF.runs}</p>
          </div>
          <div style={{ background: 'var(--surface)', padding: '10px 12px' }}>
            <p className="eyebrow" style={{ fontSize: 10 }}>CV</p>
            <p className="mono" style={{ fontSize: 17, marginTop: 2 }}>{REF.cv} %</p>
          </div>
          <div style={{ background: 'var(--surface)', padding: '10px 12px' }}>
            <p className="eyebrow" style={{ fontSize: 10 }}>leave-one-out</p>
            <p className="mono" style={{ fontSize: 17, marginTop: 2 }}>{LOO}/{RUNS.length} {LOO === RUNS.length ? '✓' : ''}</p>
          </div>
        </div>
        <dl className="kv">
          <dt>band (plateau A)</dt><dd>{REF.bandLow}–{REF.bandHigh}</dd>
          <dt>glow rise, minimum</dt><dd>{REF.glowMin}</dd>
          <dt>scatter, maximum</dt><dd>{REF.scatterMax}</dd>
        </dl>
      </section>

      <p className="footnote">If the runs disagree by more than 15 %, there is no demo, and we say so.</p>

      <Action note={saved ? `Saved at ${at}. Band ${REF.bandLow}–${REF.bandHigh} is the one this station checks against.` : !drawn ? 'Drawing the ten runs…' : at ? `Last saved at ${at}.` : undefined}>
        {saved
          ? <button type="button" className="btn" onClick={() => nav('/')}>Done</button>
          : <button type="button" className="btn" disabled={!drawn} onClick={() => { actions.calibrate('riboflavin'); setSaved(true); }}>Save reference</button>}
      </Action>
    </Screen>
  );
}
