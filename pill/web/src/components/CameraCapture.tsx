// Camera panel for the Gemini features. It is only mounted after a tap, and only then asks for the camera; it stops the
// camera when it closes. `count` 1 takes one photo; 3 takes three frames a second apart. Always offers a file instead
// (image, or for frames also a video, sampled to 3 frames): that is the path on desktop, in headless and when the camera
// is refused. Frames go to the parent as JPEG data URLs ≤ 300 KB and are never stored.
import { useEffect, useRef, useState } from 'react';
import { fileToFrames, grabFrame, openCamera, stopCamera } from '../lib/camera';
import { playSound } from '../lib/sound';

export default function CameraCapture({ count, title, onFrames, onCancel }: {
  count: 1 | 3; title: string; onFrames: (frames: string[]) => void; onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'opening' | 'live' | 'none' | 'taking'>('opening');
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(0);

  useEffect(() => {
    let alive = true;
    const v = video.current;
    if (!v) return;
    openCamera(v)
      .then((s) => { if (alive) { stream.current = s; setState('live'); } else stopCamera(s); })
      .catch((e: Error) => { if (alive) { setState('none'); setError(e.name === 'NotAllowedError' ? 'The camera was not allowed.' : `No camera here (${e.message}).`); } });
    return () => { alive = false; stopCamera(stream.current); stream.current = null; };
  }, []);

  const take = async () => {
    const v = video.current;
    if (!v) return;
    setState('taking');
    const frames: string[] = [];
    try {
      for (let i = 0; i < count; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1000));
        frames.push(grabFrame(v));
        setTaken(i + 1);
        playSound('tick', { step: i });
      }
      stopCamera(stream.current); stream.current = null;
      onFrames(frames);
    } catch (e) {
      setError((e as Error).message); setState('live');
    }
  };

  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    try { onFrames(await fileToFrames(f, count)); } catch (e) { setError(`Could not read that file: ${(e as Error).message}`); }
  };

  return (
    <section className="card stack cn-field cam-panel" style={{ gap: 12 }} aria-label={title} data-camera={state}>
      <div className="row between" style={{ gap: 8 }}>
        <span className="eyebrow">{title}</span>
        <span className={'chip' + (state === 'live' ? ' live beat' : state === 'none' ? '' : ' live')}><span className="dot" />{state === 'live' ? 'camera on' : state === 'taking' ? `frame ${taken} of ${count}` : state === 'opening' ? 'opening camera…' : 'no camera'}</span>
      </div>
      <div className="cam-frame" style={{ display: state === 'none' ? 'none' : undefined }}>
        <video ref={video} playsInline muted aria-label="Camera preview" />
      </div>
      {error && <p style={{ fontSize: 17 }} role="status">{error} You can choose a photo{count > 1 ? ' or a short video' : ''} instead.</p>}
      {state !== 'none' && (
        <button type="button" className="btn" disabled={state !== 'live'} onClick={() => void take()} style={{ minHeight: 60, fontSize: 19 }}>
          {count === 1 ? 'Take the photo' : 'Take 3 frames'}
        </button>
      )}
      <label className="btn ghost" style={{ minHeight: 56, fontSize: 18 }}>
        {count === 1 ? 'Choose a photo instead' : 'Choose a photo or video instead'}
        <input type="file" accept={count === 1 ? 'image/*' : 'image/*,video/*'} data-camera-file
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <button type="button" className="btn ghost" onClick={onCancel} style={{ minHeight: 48 }}>Cancel</button>
      <p className="footnote">Camera only while this panel is open. Photos stay in this tab’s memory and are not saved.</p>
    </section>
  );
}
