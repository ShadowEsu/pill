// Camera-style frame for the label photo. Corner brackets fly in and breathe while waiting, lock on while reading; a scan
// line sweeps up and down over the photo (or the demo label) with a focus reticle, and a glass status bar fills.
// The whole frame is the file input's label (tap = open the camera). Reduced motion: still frame, no sweep.
import './cinema.css';

export interface DemoLabel { drug: string; strength: string; lot: string; maker: string; expiry: string }

export default function Viewfinder({ preview, reading, live, onFile, demo, readMs = 1200 }: {
  preview: string | null; reading: boolean; live: boolean; onFile: (f: File) => void;
  /** shown inside the frame while the demo label is read (no photo) */ demo?: DemoLabel | null;
  readMs?: number;
}) {
  const state = reading ? 'reading' : 'idle';
  return (
    <label className={`cn-vf ${state}${preview ? ' has-img' : ''}${reading ? ' busy' : ''}`} data-viewfinder={state}>
      <input type="file" accept="image/*" capture="environment" disabled={reading} aria-label="Photograph the label"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {preview
        ? <img className="cn-vf-img" src={preview} alt="Label photo" />
        : reading && demo
          ? <span className="cn-vf-demo" aria-hidden="true">
              <span className="cn-vf-label">
                <i>{demo.maker}</i>
                <b>{demo.drug}</b>
                <i>{demo.strength} · lot {demo.lot} · exp {demo.expiry}</i>
                <span className="bar" />
              </span>
            </span>
          : <span className="cn-vf-empty">
              <span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Photograph the label</span>
                <span className="footnote">Tap to open the camera</span>
              </span>
            </span>}
      <span className="cn-vf-grid" aria-hidden="true" />
      <span aria-hidden="true" className="cn-vf-corner tl" style={{ animationDelay: '0ms' }} />
      <span aria-hidden="true" className="cn-vf-corner tr" style={{ animationDelay: '60ms' }} />
      <span aria-hidden="true" className="cn-vf-corner bl" style={{ animationDelay: '120ms' }} />
      <span aria-hidden="true" className="cn-vf-corner br" style={{ animationDelay: '180ms' }} />
      {reading && <>
        <span aria-hidden="true" className="cn-vf-scan" />
        <span aria-hidden="true" className="cn-vf-reticle" />
        <span aria-hidden="true" className="cn-vf-rec">READING</span>
        <span className="cn-vf-status" role="status">
          <span style={{ display: 'block', fontWeight: 500, paddingBottom: 10 }}>{live ? 'Gemini is reading the label…' : 'Reading the label…'}</span>
          <span className={'cn-progress' + (live ? ' live' : '')} style={{ '--ms': `${readMs}ms` } as React.CSSProperties}><i /></span>
        </span>
      </>}
    </label>
  );
}
