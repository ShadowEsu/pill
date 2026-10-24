// Add a bottle: photograph the label → five editable fields → openFDA recall lookup → save.
// Label reading is NOT wired yet: fields are prefilled from ?demo= or the file name, and the screen says so.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Action, Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';
import type { RecallStatus } from '../lib/types';

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

const READ_MS = 1200, CHECK_MS = 800, TYPE_MS = 340, TYPE_GAP = 110;
const TYPE_TOTAL = TYPE_GAP * (KEYS.length - 1) + TYPE_MS;

type Step = 'photo' | 'reading' | 'fields' | 'attach';

function Viewfinder({ preview, reading, onFile }: { preview: string | null; reading: boolean; onFile: (f: File) => void }) {
  // corners breathe outward (--dx/--dy) while waiting for a photo; a scan line sweeps once when reading starts
  const corner = (dx: number, dy: number, pos: React.CSSProperties): React.CSSProperties => ({ borderColor: preview ? '#fff' : 'var(--ink-2)', '--dx': dx, '--dy': dy, ...pos } as React.CSSProperties);
  return (
    <label className={'card' + (!preview && !reading ? ' bot-breathe' : '')} style={{ position: 'relative', display: 'block', aspectRatio: '4 / 3', padding: 0, overflow: 'hidden', cursor: reading ? 'default' : 'pointer' }}>
      <input type="file" accept="image/*" capture="environment" disabled={reading} aria-label="Photograph the label"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {preview
        ? <img src={preview} alt="Label photo" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', background: 'linear-gradient(180deg, var(--surface), var(--bg))' }}>
            <span style={{ display: 'grid', gap: 6, padding: '12px 18px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Photograph the label</span>
              <span className="footnote">Tap to open the camera</span>
            </span>
          </span>}
      <span aria-hidden="true" className="bot-corner" style={corner(-1, -1, { top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 })} />
      <span aria-hidden="true" className="bot-corner" style={corner(1, -1, { top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 })} />
      <span aria-hidden="true" className="bot-corner" style={corner(-1, 1, { bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 })} />
      <span aria-hidden="true" className="bot-corner" style={corner(1, 1, { bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 })} />
      {reading && <span aria-hidden="true" className="bot-scan" />}
      {reading && (
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 0', background: 'var(--glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} role="status">
          <span style={{ display: 'block', fontWeight: 500, paddingBottom: 10 }}>Reading the label…</span>
          <span style={{ display: 'block', height: 3, marginInline: -16, background: 'var(--sky-tint)' }}>
            <span className="bottle-progress" style={{ display: 'block', height: '100%', background: 'var(--sky)' }} />
          </span>
        </span>
      )}
    </label>
  );
}

function RecallLine({ checking, status }: { checking: boolean; status: RecallStatus | null }) {
  if (checking || !status) return <span className="chip" role="status"><span className="bottle-spin" aria-hidden="true" />checking openFDA…</span>;
  if (status === 'recall') return <span key="recall" className="chip bad pop-in" role="status"><span className="dot" />RECALL · openFDA {RECALL_ID}</span>;
  return <span key="clear" className="chip ok pop-in" role="status"><span className="dot" />no openFDA record · checked just now</span>;
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

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const startReading = (file: File | null) => {
    setValues(prefill(params.get('demo'), file?.name ?? null));
    setPreview(file ? URL.createObjectURL(file) : null);
    setStep('reading');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setPreview(null); setTypedMs(0); setStep('fields'); }, READ_MS);
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

  return (
    <Screen title={step === 'attach' ? 'Attach to delivery' : 'Add a bottle'} eyebrow={`Step ${stepNo} of 3`} back="/">
      {step !== 'attach' && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: -4 }}>
          <span className="chip" title="Label reading is not connected yet; fields are demo values."><span className="dot" />label reading · demo</span>
          {step === 'fields' && <span className="chip ok rise"><span className="dot" />photo deleted</span>}
        </div>
      )}
      <style>{`
        .bottle-progress { animation: bottle-fill ${READ_MS}ms linear both; }
        @keyframes bottle-fill { from { width: 0 } to { width: 100% } }
        .bottle-spin { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--sky-tint); border-top-color: var(--sky); animation: bottle-spin .8s linear infinite; }
        @keyframes bottle-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .bottle-spin { animation: none; border-color: var(--sky); } }
      `}</style>

      {(step === 'photo' || step === 'reading') && (
        <>
          <Viewfinder preview={preview} reading={step === 'reading'} onFile={startReading} />
          <p className="footnote" style={{ textAlign: 'center' }}>Front of the bottle, lot number in view. Good light helps.</p>
          {step === 'photo' && (
            <button type="button" className="btn ghost" onClick={() => startReading(null)} style={{ marginTop: 'auto' }}>
              No camera? Use the demo label
            </button>
          )}
        </>
      )}

      {step === 'fields' && (
        <>
          <section className="card rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }} aria-label="Label fields">
            {KEYS.map((k, i) => (
              <label key={k} style={{ display: 'grid', gap: 6, gridColumn: `span ${SPAN[k]}`, minWidth: 0 }}>
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
            <p className="footnote" style={{ gridColumn: '1 / -1' }}>Fields stay editable. The photo is deleted after reading.</p>
          </section>
          {ready && (
            <div className="stack rise" style={{ gap: 8 }}>
              <span className="eyebrow">Recall check</span>
              <div><RecallLine checking={checking} status={checked?.status ?? null} /></div>
              {!checking && checked?.status === 'recall' && (
                <p style={{ fontSize: 15 }}>
                  {mode === 'medical'
                    ? 'This lot has a recall record. Policy P4 holds any payment for it, whatever the tablet shows.'
                    : 'This lot has a recall record. Ask your pharmacist before taking it.'}
                </p>
              )}
            </div>
          )}
          <Action>
            {mode === 'medical'
              ? <button type="button" className="btn" disabled={!canSave} onClick={toAttach}>Save</button>
              : <>
                  <button type="button" className="btn" disabled={!canSave} onClick={() => nav(`/place?bottle=${save()}`)}>Test one tablet</button>
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
                <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(d.id)}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 14, padding: '14px 0', minHeight: 64, border: 0, borderTop: i ? '1px solid var(--line)' : 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
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
            <button type="button" className="btn" disabled={!pick} onClick={() => { actions.attachBottle(pick!, bottleId); nav(`/place?bottle=${bottleId}&delivery=${pick}`); }}>
              Attach and place the tablet
            </button>
            <button type="button" className="btn ghost" onClick={() => nav(`/place?bottle=${bottleId}`)}>Not from a delivery</button>
          </Action>
        </>
      )}
    </Screen>
  );
}
