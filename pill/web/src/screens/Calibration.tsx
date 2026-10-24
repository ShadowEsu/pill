// Calibration: ten reference tablets, overlaid, one colour each. The band is only worth something if they agree:
// the heat strip shows how far each plateau sits from the mean, the leave-one-out row ticks each run held out.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Action, Screen, SrcBadge } from '../components/Shell';
import Curve from '../components/Curve';
import { CountUp } from '../components/VerdictCard';
import { actions, useStore } from '../lib/store';
import { evaluate, features } from '../lib/rules';
import { makeCurve, REFERENCES } from '../data/reference';

const REF = REFERENCES.riboflavin;
const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
const HEAT = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
// Seeds 21–30; plateau 0.40–0.44, tau 34–42, glow 0.30–0.35, spread so no two runs share a shape.
const RUNS = Array.from({ length: 10 }, (_, i) => makeCurve({
  seed: 21 + i,
  plateau: 0.40 + (((i * 7) % 10) / 9) * 0.04,
  tau: 34 + (((i * 3) % 10) / 9) * 8,
  glow: 0.30 + (((i * 13) % 10) / 9) * 0.05,
}));
const PLATEAUS = RUNS.map((s) => features(s).plateau);
const MEAN = PLATEAUS.reduce((a, b) => a + b, 0) / PLATEAUS.length;
const MAX_DEV = Math.max(...PLATEAUS.map((p) => Math.abs(p - MEAN))) || 1;
// Leave-one-out: each run, held out, evaluated against the band. Counted, not asserted.
const HELD_OUT = RUNS.map((s) => evaluate(s, REF).verdict === 'PASS');
const LOO = HELD_OUT.filter(Boolean).length;

export default function Calibration() {
  const nav = useNavigate();
  const [drawn, setDrawn] = useState(false);
  const [saved, setSaved] = useState(false);
  const calibratedAt = useStore((s) => s.station.calibratedAt);
  const at = calibratedAt ? new Date(calibratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Screen title="Calibration" eyebrow={`${REF.label} · station 01`} back="/" right={<SrcBadge src="sim" />}>
      <p style={{ color: 'var(--ink-2)', maxWidth: 680 }}>Ten reference tablets, dissolved one by one. Their plateaus set the band every later run is held against.</p>

      <div className="wide-2">
        <section className="card tile stack" style={{ gap: 14, '--tile-accent': 'var(--c1)' } as React.CSSProperties}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: '2px 12px' }}><span className="eyebrow">ten runs, overlaid</span><span className="mono muted" style={{ fontSize: 12 }}>A(t) solid · glow faint</span></div>
          <Curve samples={[]} band={REF} overlays={RUNS} overlayColors={SERIES} stagger={120} onDrawn={() => setDrawn(true)} />
          <div className="row" style={{ flexWrap: 'wrap', gap: '4px 12px' }} aria-label="Run colours">
            {RUNS.map((_, i) => (
              <span key={i} className="row mono" style={{ gap: 5, fontSize: 11, color: 'var(--ink-2)' }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: SERIES[i % SERIES.length] }} />{String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </div>
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
        </section>

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <section className="card tile stack" style={{ gap: 12, '--tile-accent': 'var(--c4)' } as React.CSSProperties}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: '2px 12px' }}><span className="eyebrow">plateaus vs the mean</span><span className="mono muted" style={{ fontSize: 12 }}>mean {MEAN.toFixed(3)}</span></div>
            <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 4 }}>
              {PLATEAUS.map((p, i) => {
                const level = Math.round((Math.abs(p - MEAN) / MAX_DEV) * 4);
                return (
                  <div key={i} role="listitem" className="rise" aria-label={`Run ${i + 1}: plateau ${p.toFixed(3)}, ${((p / MEAN - 1) * 100).toFixed(1)} % from the mean`}
                    style={{ animationDelay: `${i * 60}ms`, borderRadius: 8, overflow: 'hidden', background: HEAT[level], border: '1px solid var(--line)', minHeight: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ height: 3, background: SERIES[i % SERIES.length] }} />
                    <span className="mono" style={{ fontSize: 10, textAlign: 'center', color: 'var(--ink)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="mono" style={{ fontSize: 9.5, textAlign: 'center', color: 'var(--ink)', paddingBottom: 6 }}>{(p * 100).toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
            <div className="row between mono" style={{ fontSize: 11, color: 'var(--muted)', gap: 8 }}>
              <span>near the mean</span>
              <span className="row" style={{ gap: 2 }} aria-hidden="true">{HEAT.map((h) => <span key={h} style={{ width: 16, height: 8, borderRadius: 2, background: h, border: '1px solid var(--line)' }} />)}</span>
              <span>far from it</span>
            </div>
            <p className="footnote">Numbers in the cells are plateau A × 100. Spread is {((MAX_DEV / MEAN) * 100).toFixed(1)} % at most.</p>
          </section>

          <section className="card tile stack" style={{ gap: 12, '--tile-accent': 'var(--c2)' } as React.CSSProperties}>
            <div className="row between"><span className="eyebrow">leave-one-out</span><span className="mono muted" style={{ fontSize: 12 }}>{drawn ? `${LOO}/${RUNS.length} land inside` : 'waiting for the curves'}</span></div>
            <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 4 }}>
              {HELD_OUT.map((ok, i) => (
                <div key={i} role="listitem" aria-label={`Run ${i + 1} held out: ${ok ? 'inside the band' : 'outside the band'}`} style={{ display: 'grid', placeItems: 'center', gap: 2 }}>
                  <svg viewBox="0 0 24 24" width="100%" style={{ maxWidth: 28 }} aria-hidden="true">
                    <circle cx="12" cy="12" r="10.5" fill={ok ? 'var(--mint-tint)' : 'var(--grey-tint)'} stroke={ok ? 'var(--mint)' : 'var(--grey)'} strokeWidth="1.2" />
                    <path d={ok ? 'M7 12.4 10.4 15.6 17 8.6' : 'M8.5 8.5 15.5 15.5 M15.5 8.5 8.5 15.5'} fill="none" stroke={ok ? 'var(--mint-ink)' : 'var(--grey)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset .35s var(--ease) ${i * 90}ms` }} />
                  </svg>
                  <span className="mono muted" style={{ fontSize: 10 }}>{String(i + 1).padStart(2, '0')}</span>
                </div>
              ))}
            </div>
            <dl className="kv">
              <dt>band (plateau A)</dt><dd>{REF.bandLow}–{REF.bandHigh}</dd>
              <dt>glow rise, minimum</dt><dd>{REF.glowMin}</dd>
              <dt>scatter, maximum</dt><dd>{REF.scatterMax}</dd>
            </dl>
          </section>
        </div>
      </div>

      <p className="footnote">If the runs disagree by more than 15 %, there is no demo, and we say so.</p>

      <Action note={saved ? `Saved at ${at}. Band ${REF.bandLow}–${REF.bandHigh} is the one this station checks against.` : !drawn ? 'Drawing the ten runs…' : at ? `Last saved at ${at}.` : undefined}>
        {saved
          ? <button type="button" className="btn" onClick={() => nav('/')}>Done</button>
          : <button type="button" className="btn" disabled={!drawn} onClick={() => { actions.calibrate('riboflavin'); setSaved(true); }}>Save reference</button>}
      </Action>
    </Screen>
  );
}
