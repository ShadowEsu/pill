// Add a bottle: photograph the label → five editable fields → openFDA recall lookup → save.
// Label reading: the photo (live camera on a 'Use the camera' tap, or a chosen file through the viewfinder) becomes a
// ≤ 300 KB JPEG and goes to POST /api/label (Gemini vision, on the app's own functions or the local service); the fields
// type in from its answer and unreadable fields stay empty. When Gemini is unavailable the fields are the demo prefill
// (?demo= or the file name) and the chip says `demo`. The photo is only held in memory, then dropped.
// Motion: the Viewfinder's brackets lock on and a scan line sweeps while reading; fields rise and type in one by one with a
// soft tick each; the recall check is a magnifier that searches until openFDA answers. Desktop: the bottle drawn large.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Action, Screen } from '../components/Shell';
import Viewfinder from '../components/Viewfinder';
import Glyph from '../components/Glyph';
import CameraCapture from '../components/CameraCapture';
import { actions, useStore } from '../lib/store';
import { readLabel } from '../lib/api';
import { fileToFrames } from '../lib/camera';
import { playSound } from '../lib/sound';
import type { RecallStatus } from '../lib/types';
import '../components/cinema.css';

interface Fields { drug: string; strength: string; lot: string; maker: string; expiry: string }
const KEYS: (keyof Fields)[] = ['drug', 'strength', 'lot', 'expiry', 'maker'];
const LABELS: Record<keyof Fields, string> = { drug: 'Drug', strength: 'Strength', lot: 'Lot', maker: 'Maker', expiry: 'Expiry' };
const SPAN: Record<keyof Fields, number> = { drug: 4, strength: 2, lot: 3, expiry: 3, maker: 6 };

const RIBOFLAVIN: Fields = { drug: 'Riboflavin', strength: '100 mg', lot: 'B2-07', maker: 'Nature’s Bounty', expiry: '2027-03' };
const CALCIUM: Fields = { drug: 'Calcium carbonate', strength: '500 mg', lot: 'TM-02', maker: 'GSK', expiry: '2026-11' };
const RECALL_LOT = 'AS1413A';
const RECALL_ID = 'D-1515-2016';

function prefill(demo: string | null, fileName: string | null): Fields {
  const d = (demo ?? '').toLowerCase();
  const f = (fileName ?? '').toLowerCase();
  if (d === 'recall' || d === RECALL_LOT.toLowerCase()) return { ...RIBOFLAVIN, lot: RECALL_LOT };
  if (d === 'tums' || d === 'tm' || d === 'tm-02' || f.includes('tums') || f.includes('tm')) return CALCIUM;
  return RIBOFLAVIN;
}

const READ_MS = 1800, CHECK_MS = 900, TYPE_MS = 420, TYPE_GAP = 170;
const TYPE_TOTAL = TYPE_GAP * (KEYS.length - 1) + TYPE_MS;

type Step = 'photo' | 'reading' | 'fields' | 'attach';

function RecallLine({ checking, status }: { checking: boolean; status: RecallStatus | null }) {
  if (checking || !status) return (
    <span className="row" style={{ gap: 10 }} role="status">
      <span className="cn-mag" aria-hidden="true"><Glyph name="lab" size={36} /></span>
      <span className="chip"><span className="cn-spin" aria-hidden="true" />checking openFDA…</span>
    </span>
  );
  return (
    <span className="row" style={{ gap: 10 }}>
      <span aria-hidden="true"><Glyph name="lab" size={36} /></span>
      {status === 'recall'
        ? <span key="recall" className="chip bad pop-in" role="status"><span className="dot" />RECALL · openFDA {RECALL_ID}</span>
        : <span key="clear" className="chip ok pop-in" role="status"><span className="dot" />no openFDA record · checked just now</span>}
    </span>
  );
}

export default function Bottle() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = useStore((s) => s.mode);
  const deliveries = useStore((s) => s.deliveries);

  const [step, setStep] = useState<Step>('photo');
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Fields>(RIBOFLAVIN);
  const [typedMs, setTypedMs] = useState(0);
  const [checked, setChecked] = useState<{ lot: string; status: RecallStatus; at: number } | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const readToken = useRef(0);
  const [label, setLabel] = useState<{ src: 'gemini' | 'demo'; note: string | null; confidence: number | null } | null>(null);
  const [liveRead, setLiveRead] = useState(false);
  const [reading, setReading] = useState<Fields | null>(null);

  const [camera, setCamera] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const showFields = (v: Fields, src: 'gemini' | 'demo', note: string | null, confidence: number | null) => {
    setValues(v);
    setLabel({ src, note, confidence });
    setPreview(null); setTypedMs(0); setStep('fields');
  };

  /** `photo`: a JPEG data URL from the camera or a chosen file; null = the demo label. */
  const startReading = (photo: { image: string; name: string | null } | null) => {
    const demo = prefill(params.get('demo'), photo?.name ?? null);
    setPreview(photo?.image ?? null);
    setReading(photo ? null : demo);
    setStep('reading');
    clearTimeout(timer.current);
    const token = ++readToken.current;
    setLiveRead(Boolean(photo));
    if (photo) {
      void readLabel(photo.image).then((r) => {
        if (token !== readToken.current) return;
        if (r.mode === 'live') {
          // Only what Gemini read; a field it could not read stays empty for the person to fill in.
          showFields({ drug: r.drug ?? '', strength: r.strength ?? '', lot: r.lot ?? '', maker: r.maker ?? '', expiry: r.expiry ?? '' }, 'gemini', null, r.confidence);
        } else {
          showFields(demo, 'demo', `Gemini unavailable (${r.error}); demo values filled in.`, null);
        }
      });
      return;
    }
    timer.current = window.setTimeout(() => showFields(demo, 'demo', null, null), READ_MS);
  };
  const fromFile = (file: File) => {
    void fileToFrames(file, 1).then(([image]) => startReading({ image, name: file.name }))
      .catch(() => showFields(prefill(params.get('demo'), file.name), 'demo', 'Could not open that photo; demo values filled in.', null));
  };

  // Fields type themselves in, one after another; editable once typed.
  const typing = step === 'fields' && typedMs < TYPE_TOTAL;
  useEffect(() => {
    if (step !== 'fields') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { const id = requestAnimationFrame(() => setTypedMs(TYPE_TOTAL)); return () => cancelAnimationFrame(id); }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const e = Math.min(TYPE_TOTAL, t - t0); setTypedMs(e); if (e < TYPE_TOTAL) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);
  const shown = (k: keyof Fields, i: number) => {
    if (!typing) return values[k];
    const p = Math.max(0, Math.min(1, (typedMs - i * TYPE_GAP) / TYPE_MS));
    return values[k].slice(0, Math.ceil(p * values[k].length));
  };
  // the caret sits in the field that started typing most recently
  const caretAt = typing ? Math.min(KEYS.length - 1, Math.floor(typedMs / TYPE_GAP)) : -1;
  // one soft tick as each field starts typing, a semitone higher each time
  useEffect(() => { if (caretAt >= 0) playSound('tick', { step: caretAt }); }, [caretAt]);

  // openFDA lookup (demo: one known recalled lot). Re-runs, debounced, whenever the lot changes.
  const lot = values.lot.trim().toUpperCase();
  const ready = step === 'fields' && !typing;
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setChecked({ lot, status: lot === RECALL_LOT ? 'recall' : 'no_record', at: Date.now() }), CHECK_MS);
    return () => clearTimeout(id);
  }, [ready, lot]);
  const checking = !checked || checked.lot !== lot;
  const canSave = ready && !checking && values.drug.trim() !== '' && lot !== '';

  const save = () => {
    const b = actions.addBottle({
      drug: values.drug.trim(), strength: values.strength.trim(), lot, maker: values.maker.trim(), expiry: values.expiry.trim(),
      recall: checked!.status, recallCheckedAt: checked!.at,
    });
    return b.id;
  };

  const sorted = useMemo(() => {
    const m = (l: string) => (l.toUpperCase() === lot ? 0 : 1);
    return [...deliveries].sort((a, b) => m(a.lot) - m(b.lot));
  }, [deliveries, lot]);

  const toAttach = () => {
    const id = save();
    setBottleId(id);
    setPick(sorted[0] && sorted[0].lot.toUpperCase() === lot ? sorted[0].id : null);
    setStep('attach');
  };

  const stepNo = step === 'photo' || step === 'reading' ? 1 : step === 'fields' ? (checking ? 2 : 3) : 3;
  const sideText = step === 'photo' ? 'Point the camera at the label.' : step === 'reading' ? 'Reading the lot, the strength and the maker.' : step === 'fields' ? (checking ? 'Checking openFDA for a recall on this lot.' : checked?.status === 'recall' ? 'This lot has a recall record.' : 'No recall record. Ready to save.') : 'Saved. Which delivery was it in?';

  return (
    <Screen title={step === 'attach' ? 'Attach to delivery' : 'Add a bottle'} eyebrow={`Step ${stepNo} of 3`} back="/" tone="sky" art={<Glyph name="bottle" size={48} />}>
      <div className="cn-bottle">
        <div className="cn-bottle-main">
          {step !== 'attach' && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: -4 }}>
              {label?.src === 'gemini'
                ? <span className="chip ok pop-in" data-label-src="gemini" title="Read by Gemini on the server; the percentage is the model's own confidence."><span className="dot" />label reading · gemini{label.confidence !== null ? ` · ${Math.round(label.confidence * 100)} %` : ''}</span>
                : label?.src === 'demo'
                  ? <span className="chip warn pop-in" data-label-src="demo" title={label.note ?? 'Demo label: no photo was read.'}><span className="dot" />label reading · demo</span>
                  : <span className={'chip' + (step === 'reading' ? ' live' : '')} title="A photo goes to Gemini on the server; demo values only if it is unavailable."><span className="dot" />label reading · gemini</span>}
              {step === 'fields' && <span className="chip ok pop-in" style={{ animationDelay: '200ms' }}><span className="dot" />photo deleted</span>}
            </div>
          )}

          {step === 'photo' && camera && (
            <CameraCapture count={1} title="Photograph the label" onCancel={() => setCamera(false)}
              onFrames={([image]) => { setCamera(false); startReading({ image, name: null }); }} />
          )}
          {(step === 'reading' || (step === 'photo' && !camera)) && (
            <>
              <Viewfinder preview={preview} reading={step === 'reading'} live={liveRead} onFile={fromFile} demo={reading} readMs={READ_MS} />
              <p className="footnote" style={{ textAlign: 'center' }}>Front of the bottle, lot number in view. Good light helps.</p>
              {step === 'photo' && (
                <div className="stack" style={{ gap: 10, marginTop: 'auto' }}>
                  <button type="button" className="btn" data-action="camera" onClick={() => setCamera(true)} style={{ minHeight: 60, fontSize: 19 }}>
                    Use the camera
                  </button>
                  <button type="button" className="btn ghost" onClick={() => startReading(null)}>
                    No camera? Use the demo label
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'fields' && (
            <>
              <section className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }} aria-label="Label fields">
                {KEYS.map((k, i) => (
                  <label key={k} className={'cn-field' + (caretAt === i ? ' typing' : '')} style={{ display: 'grid', gap: 6, gridColumn: `span ${SPAN[k]}`, minWidth: 0, animationDelay: `${i * TYPE_GAP}ms` }}>
                    <span className="eyebrow">{LABELS[k]}</span>
                    <span className="bot-field">
                      <input type="text" value={shown(k, i)} readOnly={typing} spellCheck={false}
                        style={k === 'lot' || k === 'expiry' ? { fontFamily: 'var(--mono)', fontSize: 16 } : undefined}
                        placeholder={k === 'expiry' ? 'YYYY-MM' : undefined}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
                      {caretAt === i && (
                        <span className="bot-mirror" aria-hidden="true" style={k === 'lot' || k === 'expiry' ? { fontFamily: 'var(--mono)', fontSize: 16 } : undefined}>
                          {shown(k, i)}<span className="caret" />
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                <p className="footnote" style={{ gridColumn: '1 / -1' }}>
                  {label?.src === 'gemini' ? 'Read by Gemini. Check every field against the bottle; empty means it could not read it.' : label?.note ?? 'Demo label values.'}{' '}Fields stay editable. The photo is deleted after reading.
                </p>
              </section>
              {ready && (
                <div className="stack cn-field" style={{ gap: 8 }}>
                  <span className="eyebrow">Recall check</span>
                  <div><RecallLine checking={checking} status={checked?.status ?? null} /></div>
                  {!checking && checked?.status === 'recall' && (
                    <p className="cn-field" style={{ fontSize: 15 }}>
                      {mode === 'medical'
                        ? 'This lot has a recall record. Policy P4 holds any payment for it, whatever the tablet shows.'
                        : 'This lot has a recall record. Ask your pharmacist before taking it.'}
                    </p>
                  )}
                </div>
              )}
              <Action>
                {mode === 'medical'
                  ? <button type="button" className={'btn' + (canSave ? ' cn-ready' : '')} disabled={!canSave} onClick={toAttach}>Save</button>
                  : <>
                      <button type="button" className={'btn' + (canSave ? ' cn-ready' : '')} disabled={!canSave} onClick={() => nav(`/place?bottle=${save()}`)}>Test one tablet</button>
                      <button type="button" className="btn ghost" disabled={!canSave} onClick={() => { save(); nav('/medicines'); }}>Save without testing</button>
                    </>}
              </Action>
            </>
          )}

          {step === 'attach' && bottleId && (
            <>
              <p style={{ color: 'var(--ink-2)' }}>Bottle saved. Which delivery did it come in?</p>
              <section className="card" style={{ padding: '4px 18px' }} role="radiogroup" aria-label="Deliveries">
                {sorted.map((d, i) => {
                  const match = d.lot.toUpperCase() === lot;
                  const on = pick === d.id;
                  return (
                    <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(d.id)} className="cn-field"
                      style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 14, padding: '14px 0', minHeight: 64, border: 0, borderTop: i ? '1px solid var(--line)' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: on ? '6px solid var(--ink)' : '1.5px solid var(--line-2)', transition: 'border .2s var(--ease)' }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.supplier}</span>
                        <span className="mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>lot {d.lot} · {d.drug}</span>
                        <span className="mono" style={{ display: 'block', fontSize: 12.5 }}>${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="muted">SANDBOX</span></span>
                      </span>
                      {match ? <span className="chip ok"><span className="dot" />lot match</span> : <span />}
                    </button>
                  );
                })}
              </section>
              <Action>
                <button type="button" className={'btn' + (pick ? ' cn-ready' : '')} disabled={!pick} onClick={() => { actions.attachBottle(pick!, bottleId); nav(`/place?bottle=${bottleId}&delivery=${pick}`); }}>
                  Attach and place the tablet
                </button>
                <button type="button" className="btn ghost" onClick={() => nav(`/place?bottle=${bottleId}`)}>Not from a delivery</button>
              </Action>
            </>
          )}
        </div>

        <aside className="cn-bottle-side" aria-hidden="true">
          <Glyph name="bottle" size={200} />
          <p className="eyebrow">step {stepNo} of 3</p>
          <p key={sideText} className="serif cn-field" style={{ fontSize: 26, lineHeight: 1.12, textAlign: 'center' }}>{sideText}</p>
        </aside>
      </div>
    </Screen>
  );
}
