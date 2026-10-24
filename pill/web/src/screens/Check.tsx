// /check: run the Gemini checker by hand. Pick the sensor result (the last finished run, or one of the two demo runs),
// photograph the label, add up to 3 frames of the cup, run. Camera only on a tap; every button also takes a file
// (image, or video for the frames), which is the path on desktop and in headless. Photos stay in this screen's memory.
import { useMemo, useState } from 'react';
import { Screen } from '../components/Shell';
import Glyph from '../components/Glyph';
import CameraCapture from '../components/CameraCapture';
import Checker, { sensorOf, useChecker } from '../components/Checker';
import { useStore } from '../lib/store';
import { evaluate } from '../lib/rules';
import { REFERENCES, REPLAYS } from '../data/reference';
import { getRunFrames } from '../lib/camera';
import type { CheckRequest, CheckSensor } from '../lib/api';
import { VERDICT_CLASS } from '../components/VerdictCard';

interface Source { key: string; title: string; sensor: CheckSensor; runId: string | null }

function demoSource(key: 'TM-02' | 'B2-07'): Source {
  const rep = REPLAYS[key];
  const ref = REFERENCES[rep.drug];
  const ev = evaluate(rep.samples, ref);
  return {
    key: `demo-${key}`, title: `Demo lot ${key}`, runId: null,
    sensor: { verdict: ev.verdict, rule: ev.rule, plateau: ev.plateau, band: [ref.bandLow, ref.bandHigh], glowRise: ev.glowRise, glowMin: ref.glowMin, drug: rep.drug },
  };
}

export default function Check() {
  const runs = useStore((s) => s.runs);
  const bottles = useStore((s) => s.bottles);
  const personal = useStore((s) => s.mode) === 'personal';
  const last = useMemo(() => runs.filter((r) => r.evaluation).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null, [runs]);
  const sources = useMemo(() => {
    const out: Source[] = [];
    const s = last ? sensorOf(last) : null;
    if (last && s) out.push({ key: last.id, title: `Last run · lot ${last.lot}`, sensor: s, runId: last.id });
    out.push(demoSource('TM-02'), demoSource('B2-07'));
    return out;
  }, [last]);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const picked = sources.find((s) => s.key === pickKey) ?? sources[0];
  const [label, setLabel] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[] | null>(null);
  const [camera, setCamera] = useState<'label' | 'frames' | null>(null);
  const { state, run, reset } = useChecker();
  // frames the checker watched during that run (Run screen), unless new ones were added here
  const shownFrames = frames ?? (picked.runId ? getRunFrames(picked.runId) : []);
  const bottle = picked.runId ? bottles.find((b) => b.runId === picked.runId) : undefined;

  const start = () => {
    const req: CheckRequest = { sensor: picked.sensor, runId: picked.runId ?? picked.key, frames: shownFrames };
    if (label) req.label = { image: label };
    else if (bottle) req.bottle = { drug: bottle.drug, lot: bottle.lot, expiry: bottle.expiry, strength: bottle.strength, maker: bottle.maker };
    void run(req);
  };
  const running = state.status === 'running';

  return (
    <Screen title="Checker" eyebrow="gemini · not medical advice" back="/" tone="sky" art={<Glyph name="pharmacist" size={48} />}>
      <div className="wide-2">
        <div className="stack" style={{ gap: 14 }}>
          <p style={{ fontSize: personal ? 21 : 19, lineHeight: 1.4 }}>
            The checker reads the label, looks for a recall and looks at the cup. It explains the sensor result. It never changes it.
          </p>

          <section className="card stack" style={{ gap: 10 }} aria-label="Sensor result to check">
            <span className="eyebrow">sensor result</span>
            <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Which result">
              {sources.map((s) => {
                const on = s.key === picked.key;
                return (
                  <button key={s.key} type="button" role="radio" aria-checked={on} className="btn ghost" data-source={s.key}
                    style={{ justifyContent: 'space-between', minHeight: 56, fontSize: 17, borderColor: on ? 'var(--ink)' : undefined, borderWidth: on ? 2 : 1 }}
                    onClick={() => { setPickKey(s.key); reset(); }}>
                    <span>{s.title}</span>
                    <span className={'chip ' + VERDICT_CLASS[s.sensor.verdict]}>{s.sensor.verdict} · {s.sensor.rule}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {camera
            ? <CameraCapture key={camera} count={camera === 'label' ? 1 : 3} title={camera === 'label' ? 'Photograph the label' : 'Frames of the cup'}
                onCancel={() => setCamera(null)}
                onFrames={(f) => { if (camera === 'label') setLabel(f[0]); else setFrames(f.slice(0, 3)); setCamera(null); reset(); }} />
            : (
              <div className="ck-big-actions">
                <button type="button" className="btn ghost" data-action="label" onClick={() => setCamera('label')}>
                  {label ? 'Retake the label photo' : 'Photograph the label'}
                </button>
                <button type="button" className="btn ghost" data-action="frames" onClick={() => setCamera('frames')}>
                  {shownFrames.length ? 'Replace the frames of the cup' : 'Add frames of the cup'}
                </button>
                <button type="button" className="btn" data-action="run" disabled={running} onClick={start}>
                  {running ? 'Checking…' : 'Run the checker'}
                </button>
              </div>
            )}

          <div className="ck-chips" aria-live="polite">
            <span className={'chip' + (label ? ' ok' : '')} data-has-label={label ? 'yes' : 'no'}><span className="dot" />{label ? 'label photo ready' : bottle ? `label from saved bottle · lot ${bottle.lot}` : 'no label photo'}</span>
            <span className={'chip' + (shownFrames.length ? ' ok' : '')} data-frames-count={shownFrames.length}><span className="dot" />{shownFrames.length} frame{shownFrames.length === 1 ? '' : 's'} of the cup</span>
          </div>
          {(label || shownFrames.length > 0) && (
            <div className="ck-thumbs" aria-label="Photos in memory">
              {label && <img src={label} alt="Label photo" />}
              {shownFrames.map((f, i) => <img key={i} src={f} alt={`Cup frame ${i + 1}`} />)}
            </div>
          )}
          <p className="footnote">Photos stay in this tab’s memory and go only to the checker. Nothing is saved. A pharmacist or doctor decides.</p>
        </div>

        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          {state.status === 'idle'
            ? <section className="card stack" style={{ gap: 8, alignItems: 'center', textAlign: 'center', padding: '28px 18px' }}>
                <Glyph name="cup" size={72} />
                <p className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>The checker’s steps will show here.</p>
                <p className="footnote">Label, recall, the cup, then a short summary.</p>
              </section>
            : <Checker state={state} frames={shownFrames} />}
        </div>
      </div>
    </Screen>
  );
}
