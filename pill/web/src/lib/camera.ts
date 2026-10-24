// Camera and photo helpers for the Gemini features. The camera opens only from a tap (the caller's click handler);
// frames are JPEG data URLs ≤ 300 KB, kept in memory only (never storage, never the store) and dropped on reload.
// Without a camera (desktop, headless, permission denied) the same screens take a chosen image or video file instead:
// an image is one frame, a video gives 3 frames sampled at ¼, ½ and ¾ of its length.

export const MAX_FRAME_BYTES = 300_000;
const MAX_SIDE = 960;

/** base64 length → bytes */
const dataUrlBytes = (u: string) => Math.floor((u.length - u.indexOf(',') - 1) * 3 / 4);

/** Draw any image source to a JPEG ≤ 300 KB: ≤ 960 px on the long side, quality stepped down until it fits. */
export function toJpeg(src: CanvasImageSource, w: number, h: number): string {
  let scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55]) {
      const url = c.toDataURL('image/jpeg', q);
      if (dataUrlBytes(url) <= MAX_FRAME_BYTES) return url;
    }
    scale *= 0.75;
  }
  throw new Error('could not make the photo small enough');
}

/** Ask for the back camera. Call only from a tap. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('this browser has no camera access');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function grabFrame(video: HTMLVideoElement): string {
  if (!video.videoWidth) throw new Error('the camera has no picture yet');
  return toJpeg(video, video.videoWidth, video.videoHeight);
}

async function videoFrames(file: File, count: number): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await new Promise<void>((ok, fail) => { v.onloadeddata = () => ok(); v.onerror = () => fail(new Error('could not open the video')); });
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const out: string[] = [];
    for (let i = 1; i <= count; i++) {
      const at = d * (i / (count + 1));
      if (Math.abs(v.currentTime - at) > 0.01) await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = at; });
      out.push(toJpeg(v, v.videoWidth, v.videoHeight));
    }
    return out;
  } finally {
    v.removeAttribute('src'); v.load();
    URL.revokeObjectURL(url);
  }
}

/** A chosen file → frames: an image is one frame; a video gives `videoCount` frames. */
export async function fileToFrames(file: File, videoCount = 3): Promise<string[]> {
  if (file.type.startsWith('video/')) return videoFrames(file, videoCount);
  const bmp = await createImageBitmap(file);
  try { return [toJpeg(bmp, bmp.width, bmp.height)]; } finally { bmp.close(); }
}

// ---- frames the checker watched during a run, in memory only, for the evaluation screen ----
const runFrames = new Map<string, string[]>();
export const setRunFrames = (runId: string, frames: string[]) => { runFrames.set(runId, frames.slice(0, 3)); };
export const getRunFrames = (runId: string): string[] => runFrames.get(runId) ?? [];
