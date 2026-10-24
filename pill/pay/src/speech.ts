// Read-aloud for the app. With ELEVENLABS_API_KEY: ElevenLabs text-to-speech, streamed back as mp3.
// Without it: {mode:'unavailable'} and the app uses the browser's own voice.
import type { Response } from 'express';

/** ElevenLabs' stock "George" voice (from their quick-start); override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';
export const MAX_SPEAK_CHARS = 600;

export const speechMode = () => (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'unavailable');

/** Streams mp3 into `res`, or answers JSON {mode:'unavailable', error}. */
export async function speak(text: string, res: Response) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { res.json({ mode: 'unavailable', error: 'no ELEVENLABS_API_KEY on the service; use the browser voice' }); return; }
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok || !r.body) {
      const detail = (await r.text().catch(() => '')).slice(0, 200);
      res.status(502).json({ mode: 'unavailable', error: `elevenlabs ${r.status}: ${detail || r.statusText}` });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-PILL-VOICE', `elevenlabs ${voice}`);
    const reader = r.body.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) res.write(chunk.value);
    res.end();
  } catch (e) {
    if (res.headersSent) res.end();
    else res.status(502).json({ mode: 'unavailable', error: (e as Error).message });
  }
}
