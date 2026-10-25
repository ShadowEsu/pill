// Share one run as a 1200 × 630 PNG (link-preview size): light paper, the verdict word in serif, % of reference, lot, date,
// the two numbers (plateau, glow rise), the inline curve against its band, the caveat line and the Pill wordmark.
// Download always; the Web Share sheet too when the browser can share files.
// Exports: default ShareCard ({ run }) renders the preview + actions inline; ShareSheet ({ run, onClose }) wraps it in a modal.
import { useEffect, useRef, useState } from 'react';
import { curve } from '../lib/rules';
import { REFERENCES } from '../data/reference';
import type { Run, Verdict } from '../lib/types';
import '../story.css';

const W = 1200, H = 630;
const INK = '#16181B', INK2 = '#4A4E55', MUTED = '#7C8188', LINE = 'rgba(22,24,27,.10)', SKY = '#4FB3FF', MINT = '#5FD39A';
const VERDICT_HEX: Record<Verdict, string> = { PASS: MINT, 'NEEDS LAB': '#E09A3A', 'UNABLE TO VERIFY': '#9AA0A6' };
const SERIF = '"Instrument Serif", Georgia, serif', SANS = '"Inter", system-ui, sans-serif', MONO = '"JetBrains Mono", Menlo, monospace';
const SRC_WORD = { real: 'LIVE SENSOR', replay: 'REPLAY', sim: 'SIMULATED' } as const;

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Draws the card into `cv` (resized to 1200 × 630). Waits for the three web fonts so the serif word is the real serif. */
async function drawShareCard(cv: HTMLCanvasElement, run: Run) {
  await Promise.all([`400 160px ${SERIF}`, `600 28px ${SANS}`, `400 24px ${SANS}`, `400 20px ${MONO}`].map((f) => document.fonts?.load(f).catch(() => [])));
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return;
  const ev = run.evaluation;
  const ref = REFERENCES[run.drug] ?? REFERENCES.riboflavin;

  // paper, two soft washes, a dot grid on the right
  c.fillStyle = '#F7F8F7'; c.fillRect(0, 0, W, H);
  for (const [x, y, rgb] of [[120, 60, '79,179,255'], [1100, 600, '95,211,154']] as const) {
    const g = c.createRadialGradient(x, y, 0, x, y, 620);
    g.addColorStop(0, `rgba(${rgb},.24)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  c.fillStyle = 'rgba(22,24,27,.08)';
  for (let x = 660; x < W; x += 16) for (let y = 16; y < H; y += 16) { c.beginPath(); c.arc(x, y, 1, 0, Math.PI * 2); c.fill(); }

  // wordmark: a capsule (sky half, mint half) and "Pill"
  c.save(); c.translate(92, 72); c.rotate(-0.5);
  c.fillStyle = SKY; c.beginPath(); c.arc(-14, 0, 13, Math.PI / 2, Math.PI * 1.5); c.lineTo(0, -13); c.lineTo(0, 13); c.closePath(); c.fill();
  c.fillStyle = MINT; c.beginPath(); c.arc(14, 0, 13, -Math.PI / 2, Math.PI / 2); c.lineTo(0, 13); c.lineTo(0, -13); c.closePath(); c.fill();
  c.strokeStyle = INK; c.lineWidth = 2; roundRect(c, -27, -13, 54, 26, 13); c.stroke();
  c.restore();
  c.fillStyle = INK; c.font = `400 48px ${SERIF}`; c.textBaseline = 'alphabetic'; c.fillText('Pill', 132, 88);

  // left column: eyebrow, verdict word, bar, % of reference, lot + date
  c.font = `400 17px ${MONO}`; c.fillStyle = MUTED;
  c.fillText(`SCREENING RESULT · RUN ${run.id.toUpperCase()} · ${SRC_WORD[run.src]}`, 72, 168);
  const word = ev?.verdict ?? 'NO RESULT YET';
  let size = 172;
  c.font = `400 ${size}px ${SERIF}`;
  while (c.measureText(word).width > 560 && size > 60) { size -= 4; c.font = `400 ${size}px ${SERIF}`; }
  c.fillStyle = INK; c.fillText(word, 68, 196 + size * 0.78);
  const below = 196 + size * 0.78 + 30;
  c.fillStyle = ev ? VERDICT_HEX[ev.verdict] : MUTED; roundRect(c, 72, below, 96, 6, 3); c.fill();
  if (ev && ev.rule !== 'U1') {
    c.fillStyle = INK; c.font = `400 64px ${MONO}`; c.fillText(`${ev.pct} %`, 72, below + 92);
    const w = c.measureText(`${ev.pct} %`).width;
    c.fillStyle = INK2; c.font = `400 24px ${SANS}`; c.fillText('of reference', 72 + w + 16, below + 90);
  }
  const date = new Date(run.startedAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  c.fillStyle = INK2; c.font = `400 24px ${SANS}`;
  c.fillText(`${run.drug[0].toUpperCase()}${run.drug.slice(1)} · lot ${run.lot} · ${date}`, 72, below + 140);

  // right column: the curve card with the band, A(t) inline and the 90° glow, then the two numbers
  const cx = 700, cy = 132, cw = 428, ch = 300;
  c.save(); c.shadowColor = 'rgba(22,24,27,.16)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
  c.fillStyle = '#fff'; roundRect(c, cx, cy, cw, ch, 22); c.fill(); c.restore();
  c.strokeStyle = LINE; c.lineWidth = 1.5; roundRect(c, cx, cy, cw, ch, 22); c.stroke();
  const px = cx + 48, py = cy + 52, pw = cw - 76, ph = ch - 100, aMax = 0.6;
  const X = (t: number) => px + (Math.min(180, Math.max(0, t)) / 180) * pw;
  const Y = (a: number) => py + ph - (Math.min(aMax, Math.max(0, a)) / aMax) * ph;
  c.font = `400 14px ${MONO}`; c.fillStyle = MUTED;
  c.fillText('A(t) inline', cx + 48, cy + 34); c.fillText('glow 90°', cx + 186, cy + 34);
  c.fillStyle = SKY; c.fillRect(cx + 26, cy + 28, 16, 3); c.fillStyle = MINT; c.fillRect(cx + 164, cy + 28, 16, 3);
  c.strokeStyle = LINE; c.lineWidth = 1;
  for (const a of [0, 0.2, 0.4, 0.6]) { c.beginPath(); c.moveTo(px, Y(a)); c.lineTo(px + pw, Y(a)); c.stroke(); c.fillStyle = MUTED; c.fillText(a.toFixed(1).slice(1), px - 34, Y(a) + 5); }
  c.fillText('0 s', px, py + ph + 24); c.textAlign = 'right'; c.fillText('180 s', px + pw, py + ph + 24); c.textAlign = 'left';
  if (ev?.rule !== 'U1') {
    c.fillStyle = 'rgba(79,179,255,.14)'; c.fillRect(px, Y(ref.bandHigh), pw, Y(ref.bandLow) - Y(ref.bandHigh));
    c.setLineDash([3, 4]); c.strokeStyle = SKY; c.strokeRect(px, Y(ref.bandHigh), pw, Y(ref.bandLow) - Y(ref.bandHigh)); c.setLineDash([]);
  }
  const pts = curve(run.samples);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 3;
  for (const [key, col] of [['g', MINT], ['a', SKY]] as const) {
    c.strokeStyle = col; c.beginPath();
    pts.forEach((p, k) => { if (k) c.lineTo(X(p.t), Y(p[key])); else c.moveTo(X(p.t), Y(p[key])); });
    c.stroke();
  }
  const nums: [string, string][] = ev ? [['plateau', ev.plateau.toFixed(2)], ['glow rise', `${ev.glowRise >= 0 ? '+' : '−'}${Math.abs(ev.glowRise).toFixed(2)}`]] : [];
  nums.forEach(([k, v], j) => {
    const x = cx + 8 + j * 220;
    c.fillStyle = MUTED; c.font = `400 15px ${MONO}`; c.fillText(k.toUpperCase(), x + 18, cy + ch + 40);
    c.fillStyle = INK; c.font = `400 40px ${MONO}`; c.fillText(v, x + 16, cy + ch + 84);
  });

  // foot: the caveat, the rule, the site
  c.strokeStyle = LINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(72, 556); c.lineTo(W - 72, 556); c.stroke();
  c.fillStyle = INK; c.font = `600 22px ${SANS}`; c.fillText('Screening result, not a pharmacopeial test.', 72, 594);
  c.fillStyle = MUTED; c.font = `400 16px ${MONO}`; c.textAlign = 'right';
  c.fillText(ev ? `rule ${ev.rule} · pillmeifyoucan.health` : 'pillmeifyoucan.health', W - 72, 592); c.textAlign = 'left';
}

const canShareFiles = () => {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'pill.png', { type: 'image/png' })] }); } catch { return false; }
};

export default function ShareCard({ run }: { run: Run }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sharable] = useState(canShareFiles);
  useEffect(() => {
    let alive = true;
    if (cv.current) drawShareCard(cv.current, run).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [run]);

  const name = `pill-${run.id}-${(run.evaluation?.verdict ?? 'no-result').toLowerCase().replace(/ /g, '-')}.png`;
  const download = () => {
    if (!cv.current) return;
    const a = document.createElement('a');
    a.href = cv.current.toDataURL('image/png');
    a.download = name;
    a.click();
    setNote(`Saved ${name}`);
  };
  const share = () => {
    cv.current?.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: `Pill · ${run.evaluation?.verdict ?? 'run'} · lot ${run.lot}`, text: 'Screening result, not a pharmacopeial test.' });
        setNote('Shared');
      } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setNote('Could not open the share sheet; use Download.'); }
    }, 'image/png');
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <canvas ref={cv} className="share-preview" width={W} height={H} data-ready={ready} role="img"
        aria-label={`Share card: ${run.evaluation?.verdict ?? 'no result yet'}, lot ${run.lot}${run.evaluation ? `, ${run.evaluation.pct} percent of reference` : ''}`} />
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" style={{ flex: '1 1 180px', width: 'auto' }} disabled={!ready} onClick={download}>Download PNG</button>
        {sharable && <button type="button" className="btn ghost" style={{ flex: '1 1 180px', width: 'auto' }} disabled={!ready} onClick={share}>Share…</button>}
      </div>
      <p className="footnote" aria-live="polite">{note ?? '1200 × 630 PNG. Screening result, not a pharmacopeial test.'}</p>
    </div>
  );
}

/** ShareCard in a modal <dialog>. Escape, the backdrop and Close all call onClose. */
export function ShareSheet({ run, onClose }: { run: Run; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  // No close() on cleanup: StrictMode's re-run would queue a 'close' event and shut the sheet; unmounting removes it anyway.
  useEffect(() => { if (dlg.current && !dlg.current.open) dlg.current.showModal(); }, []);
  return (
    <dialog ref={dlg} className="share-sheet" aria-label={`Share run ${run.id}`} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card">
        <div className="row between">
          <h2 style={{ fontSize: 20 }}>Share run {run.id}</h2>
          <button type="button" className="btn ghost" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 14 }} aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <ShareCard run={run} />
      </div>
    </dialog>
  );
}
