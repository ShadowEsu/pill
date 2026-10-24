// A big round speaker button that reads `text` aloud. ElevenLabs through the pill-pay service when it has a key,
// otherwise the browser's own voice (the chip says which). Second tap pauses, third resumes. Silent while the
// 'pill.sound' setting is off.
import { useEffect, useRef, useState } from 'react';
import { serviceVoice, speakRemote } from '../lib/api';
import { useSound } from '../lib/sound';

type Voice = 'elevenlabs' | 'browser voice' | null;
type State = 'idle' | 'loading' | 'speaking' | 'paused';

const hasBrowserVoice = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export default function ReadAloud({ text, label = 'Read aloud', size = 64 }: { text: string; label?: string; size?: number }) {
  const { on, setOn } = useSound();
  const [state, setState] = useState<State>('idle');
  const [voice, setVoice] = useState<Voice>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void serviceVoice().then((v) => { if (mounted.current) setVoice((cur) => cur ?? (v === 'elevenlabs' ? 'elevenlabs' : hasBrowserVoice() ? 'browser voice' : null)); });
    return () => {
      mounted.current = false;
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      if (hasBrowserVoice()) window.speechSynthesis.cancel();
    };
  }, []);

  // New text: stop whatever was playing.
  useEffect(() => {
    audio.current?.pause();
    audio.current = null;
    if (hasBrowserVoice()) window.speechSynthesis.cancel();
    setState('idle');
  }, [text]);

  // Sound switched off mid-sentence: stop.
  useEffect(() => {
    if (on) return;
    audio.current?.pause();
    if (hasBrowserVoice()) window.speechSynthesis.cancel();
    setState('idle');
  }, [on]);

  const speakBrowser = () => {
    if (!hasBrowserVoice()) { setError('This browser has no voice.'); setState('idle'); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.onend = () => { if (mounted.current) setState('idle'); };
    u.onerror = (e) => { if (mounted.current && e.error !== 'interrupted' && e.error !== 'canceled') { setError(`Browser voice: ${e.error}`); setState('idle'); } };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setVoice('browser voice');
    setState('speaking');
  };

  const start = async () => {
    setError(null);
    if (voice !== 'browser voice') {
      setState('loading');
      const r = await speakRemote(text);
      if (!mounted.current) return;
      if (r instanceof Blob) {
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(r);
        const a = new Audio(url.current);
        a.onended = () => { if (mounted.current) setState('idle'); };
        audio.current = a;
        setVoice('elevenlabs');
        try { await a.play(); setState('speaking'); return; } catch { audio.current = null; /* autoplay refused: fall through to the browser voice */ }
      }
    }
    speakBrowser();
  };

  const tap = () => {
    if (!on) return;
    if (state === 'loading') return;
    if (state === 'speaking') {
      if (audio.current) audio.current.pause(); else window.speechSynthesis.pause();
      setState('paused');
      return;
    }
    if (state === 'paused') {
      if (audio.current) void audio.current.play(); else window.speechSynthesis.resume();
      setState('speaking');
      return;
    }
    void start();
  };

  const icon = state === 'speaking'
    ? <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>
    : <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none" />
        {on ? <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>;
  const status = !on ? 'sound is off' : state === 'loading' ? 'getting the voice…' : state === 'speaking' ? 'reading · tap to pause' : state === 'paused' ? 'paused · tap to go on' : label;

  return (
    <div className="row" style={{ gap: 14, alignItems: 'center' }}>
      <style>{`
        .ra-btn { position: relative; flex: none; display: grid; place-items: center; border-radius: 50%; border: 0; background: var(--ink); color: #fff; cursor: pointer; transition: transform .2s var(--ease), opacity .2s; }
        .ra-btn:active { transform: scale(.96); }
        .ra-btn[aria-disabled="true"] { opacity: .45; cursor: default; }
        .ra-btn.speaking::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid var(--sky); animation: ra-ring 1.4s var(--ease) infinite; }
        @keyframes ra-ring { from { transform: scale(.92); opacity: .9 } to { transform: scale(1.18); opacity: 0 } }
        .ra-spin { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; animation: ra-spin .8s linear infinite; }
        @keyframes ra-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .ra-btn.speaking::after { animation: none; transform: scale(1.06); opacity: .8 } .ra-spin { animation: none } }
      `}</style>
      <button type="button" className={'ra-btn' + (state === 'speaking' ? ' speaking' : '')} style={{ width: size, height: size }}
        onClick={tap} aria-disabled={!on} aria-pressed={state === 'speaking'}
        aria-label={!on ? `${label} (sound is off)` : state === 'speaking' ? 'Pause reading' : state === 'paused' ? 'Resume reading' : label}>
        {state === 'loading' ? <span className="ra-spin" aria-hidden="true" /> : icon}
      </button>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }} aria-live="polite">{status}</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {voice && <span className={'chip' + (voice === 'elevenlabs' ? ' live' : '')} data-voice={voice}><span className="dot" />{voice}</span>}
          {!on && <button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setOn(true)}>turn sound on</button>}
        </div>
        {error && <span className="footnote" role="status">{error}</span>}
      </div>
    </div>
  );
}
