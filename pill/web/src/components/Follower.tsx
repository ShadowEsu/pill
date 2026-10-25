// The follower: Pill's assistant (Gemini) docked bottom-right on every screen. A round button with a glowing SpinPill
// (spins fast while it thinks) opens a sheet: a proactive tip for the screen, the transcript (answers type in as they
// stream), three suggested questions for the route, a text box with a browser-mic button, and a permanent disclaimer.
// It follows the app: a route change badges the button and, when the sheet is open, fetches a new tip. The sheet and
// the button sit above the tab bar and above the screen's .action-bar, so they never cover the primary action.
// Hidden on /kiosk and /demo, while the guided demo runs (sessionStorage['pill.demo'] === '1'), and when Settings turns it off.
// The transcript lives in this component's memory only; nothing is stored. Open/closed is remembered (pill.follower).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SpinPill from './SpinPill';
import ReadAloud from './ReadAloud';
import { useStore } from '../lib/store';
import { useReducedMotion } from '../lib/motion';
import { READ_IT, fetchTip, prettyModel, readOpen, screenContext, streamAssist, suggestions, useFollowerSettings, writeOpen, type Done, type Turn } from '../lib/follower';
import '../follower.css';

interface Msg { id: number; role: 'user' | 'model'; text: string; state: 'streaming' | 'done' | 'error'; done?: Done; replaced?: boolean; error?: string }
type TipState = { state: 'loading' } | { state: 'ok'; text: string; live: boolean; cached: boolean } | { state: 'off'; text: string };

/* ---- browser speech input (Web Speech API), typed minimally ---- */
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
type SRCtor = new () => SR;
const speechCtor = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** sessionStorage['pill.demo'] has no same-tab event: read it on every render (route changes re-render) and re-render once a second. */
function useDemoRunning() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => (n + 1) % 1e6), 1000);
    return () => clearInterval(id);
  }, []);
  try { return sessionStorage.getItem('pill.demo') === '1'; } catch { return false; }
}

interface Dock { btn: number; sheet: number; max: number }
const BTN_RIGHT = 16, SHEET_RIGHT = 24, GAP = 12;
// the desktop sheet is 380 px wide, 340 px below 1180 px (follower.css --fol-sheet-w)
const sheetW = (vw: number) => (vw < 1180 ? 340 : 380);

/** Bottom offsets that keep the button and the sheet above the phone tab bar and above any .action-bar they overlap. */
function useDock(deps: unknown[]): Dock {
  const [dock, setDock] = useState<Dock>({ btn: 84, sheet: 84, max: 560 });
  const measure = useCallback(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const nav = document.querySelector('.frame > .nav')?.getBoundingClientRect();
    const navH = nav && nav.top > vh / 2 ? vh - nav.top : 0;          // phone tab bar at the bottom; the desktop sidebar is not
    const phone = vw < 900;
    const over = (left: number, right: number) => {
      let top = vh;
      for (const el of document.querySelectorAll('.app .action-bar')) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > 0 && r.top < vh && r.right > left && r.left < right) top = Math.min(top, r.top);
      }
      return vh - top;
    };
    const base = Math.max(navH, phone ? 0 : 12);
    const btn = Math.max(base, over(vw - BTN_RIGHT - 72, vw - BTN_RIGHT)) + GAP;
    const sheet = phone ? Math.max(navH, over(0, vw)) + 8 : Math.max(base, over(vw - SHEET_RIGHT - sheetW(vw), vw - SHEET_RIGHT)) + GAP;
    const max = Math.max(240, Math.round(Math.min(phone ? vh * 0.7 : 640, vh - sheet - 12)));
    setDock((d) => (d.btn === btn && d.sheet === sheet && d.max === max ? d : { btn, sheet, max }));
  }, []);
  useLayoutEffect(() => {
    let raf = 0;
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    measure();
    const late = window.setTimeout(measure, 400);                        // after the route-enter animation
    const tick = window.setInterval(measure, 1000);                      // action bars appear when results land
    window.addEventListener('resize', soon);
    window.addEventListener('scroll', soon, { capture: true, passive: true });
    return () => { cancelAnimationFrame(raf); clearTimeout(late); clearInterval(tick); window.removeEventListener('resize', soon); window.removeEventListener('scroll', soon, { capture: true }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);
  return dock;
}

/** Streaming text types in: the shown length catches up with the received length (faster when far behind). */
function Typed({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const nRef = useRef(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const left = text.length - nRef.current;
      if (left <= 0) { if (nRef.current !== text.length) { nRef.current = text.length; setN(text.length); } return; }
      const step = Math.max(1, Math.round(((t - last) / 1000) * Math.max(120, left * 4)));
      last = t;
      nRef.current = Math.min(text.length, nRef.current + step);
      setN(nRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduce]);
  const shown = reduce ? text : text.slice(0, Math.min(n, text.length));
  return <>{shown}{!reduce && shown.length < text.length && <span className="fol-caret" aria-hidden="true" />}</>;
}

export default function Follower() {
  const { pathname } = useLocation();
  const settings = useFollowerSettings();
  const demo = useDemoRunning();
  const mode = useStore((s) => s.mode) ?? 'personal';
  const bigText = useStore((s) => s.bigText);
  const [open, setOpen] = useState(readOpen);
  const [badge, setBadge] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [tip, setTip] = useState<TipState>({ state: 'loading' });
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);   // who answered last, live from the stream's first chunk
  const nextId = useRef(1);
  const msgsRef = useRef(msgs);
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<SR | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstPath = useRef(pathname);
  const hidden = !settings.on || demo || pathname.startsWith('/kiosk') || pathname.startsWith('/demo');
  const thinking = msgs.some((m) => m.state === 'streaming');
  const dock = useDock([pathname, open, hidden, msgs.length, bigText]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  // route change: badge the closed button
  useEffect(() => {
    if (pathname === firstPath.current) return;
    firstPath.current = pathname;
    if (!open) setBadge(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // open (or route change while open): one proactive tip for this screen
  useEffect(() => {
    if (!open || hidden) return;
    let alive = true;
    setTip({ state: 'loading' });
    void fetchTip(pathname, mode, bigText, screenContext(pathname)).then((t) => {
      if (!alive) return;
      if ('tip' in t) { setTip({ state: 'ok', text: t.tip, live: t.mode === 'live', cached: t.cached }); if (t.mode === 'live') setModel((m) => m ?? t.model); }
      else setTip({ state: 'off', text: t.mode === 'busy' ? 'The assistant is busy right now. Try again in a minute.' : 'The assistant is not reachable right now.' });
    });
    return () => { alive = false; };   // a flag, not abort(): an aborted fetch shows up as a failed request
  }, [open, hidden, pathname, mode, bigText]);

  // keep the newest line in view, also while an answer types in (unless the person scrolled up to read)
  useEffect(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; }, [msgs, tip]);
  useEffect(() => {
    const b = bodyRef.current;
    if (!b) return;
    const mo = new MutationObserver(() => { if (b.scrollHeight - b.scrollTop - b.clientHeight < 80) b.scrollTop = b.scrollHeight; });
    mo.observe(b, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [open, hidden]);

  // stop the mic and any stream on unmount
  useEffect(() => () => { abort.current?.abort(); rec.current?.abort(); }, []);

  const toggle = (next: boolean) => {
    setOpen(next);
    writeOpen(next);
    if (next) setBadge(false);
    else { rec.current?.stop(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
  };

  const patch = (id: number, p: Partial<Msg>) => setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const send = async (question: string, readBack = false) => {
    const q = question.trim();
    if (!q || thinking) return;
    const history: Turn[] = msgsRef.current.filter((m) => m.state === 'done' && m.text).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    const u: Msg = { id: nextId.current++, role: 'user', text: q, state: 'done' };
    const b: Msg = { id: nextId.current++, role: 'model', text: '', state: 'streaming' };
    setMsgs((ms) => [...ms, u, b]);
    setInput('');
    const ac = new AbortController();
    abort.current = ac;
    const message = q === READ_IT ? 'Read this screen to me: say what it shows in plain words.' : q;
    const r = await streamAssist({ message, mode, bigText, route: pathname, screenContext: screenContext(pathname), history }, { text: (text) => patch(b.id, { text }), model: setModel }, ac.signal);
    if (abort.current === ac) abort.current = null;
    if (!r.ok) {
      patch(b.id, { state: 'error', error: r.error, text: r.stopped ? 'Stopped. Ask again any time.' : r.busy ? 'The assistant is busy right now. Please try again in a minute.' : 'The assistant could not answer just now. Please ask your pharmacist or doctor.' });
      return;
    }
    patch(b.id, { state: 'done', text: r.text, done: r.done, replaced: r.replaced });
    if (r.done.mode === 'live') setModel(r.done.model);
    if (readBack || settings.voice) speak(r.text);
  };

  const stop = () => abort.current?.abort();

  const mic = () => {
    setMicNote(null);
    if (listening) { rec.current?.stop(); return; }
    const Ctor = speechCtor();
    if (!Ctor) { setMicNote('This browser has no speech input. Please type instead.'); return; }
    const r = new Ctor();
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;   // one phrase: it stops on silence
    let heard = '';
    r.onresult = (e) => {
      let text = '';
      for (let k = 0; k < e.results.length; k++) text += e.results[k][0].transcript;
      heard = text;
      setInput(text);
    };
    r.onerror = (e) => setMicNote(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The mic is blocked for this site.' : e.error === 'no-speech' ? 'I did not hear anything.' : `Mic: ${e.error}`);
    r.onend = () => { setListening(false); rec.current = null; if (heard.trim()) void send(heard); };
    rec.current = r;
    try { r.start(); setListening(true); } catch (e) { setMicNote(`Mic: ${(e as Error).message}`); rec.current = null; }
  };

  // phone: drag the sheet down by its grabber or header to close it (a short drag springs back)
  const drag = useRef<{ y: number; dy: number; id: number } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const onDown = (e: React.PointerEvent) => {
    if (window.innerWidth >= 900 || (e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheetRef.current?.classList.add('dragging');
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y);
    sheetRef.current?.style.setProperty('--fol-drag', `${d.dy}px`);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    sheetRef.current?.classList.remove('dragging');
    sheetRef.current?.style.setProperty('--fol-drag', '0px');
    if (d && d.dy > 90) toggle(false);
  };

  if (hidden) return null;
  const chips = suggestions(pathname, mode);
  const vars = { '--fol-btn-bottom': `${dock.btn}px`, '--fol-sheet-bottom': `${dock.sheet}px`, '--fol-sheet-max': `${dock.max}px` } as React.CSSProperties;

  return (
    <div className={'fol' + (bigText ? ' fol-big' : '')} style={vars} data-follower={open ? 'open' : 'closed'}>
      {!open && (
        <button type="button" className={'fol-dock' + (thinking ? ' thinking' : '')} onClick={() => toggle(true)} aria-label={badge ? 'Open the Pill assistant (new tip for this screen)' : 'Open the Pill assistant'}>
          <SpinPill size={bigText ? 58 : 44} glow speed={thinking ? 3 : 0.35} label="Pill assistant" />
          {badge && <span className="fol-badge" aria-hidden="true" />}
        </button>
      )}
      {open && (
        <section ref={sheetRef} className="fol-sheet" role="dialog" aria-modal="false" aria-labelledby="fol-title" onKeyDown={(e) => { if (e.key === 'Escape') toggle(false); }}>
          <div className="fol-grab-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <span className="fol-grabber" aria-hidden="true" />
            <header className="fol-head">
              <span className="fol-head-pill"><SpinPill size={bigText ? 44 : 36} glow speed={thinking ? 3 : 0.35} label={thinking ? 'Thinking' : 'Pill assistant'} /></span>
              <span className="fol-head-txt">
                <span id="fol-title" className="fol-title">Pill assistant · Gemini</span>
                <span className="fol-sub">{model && <span className="fol-model" data-model={model}>{prettyModel(model)}</span>}Kept in memory only; gone when you reload.</span>
              </span>
              <button type="button" className="btn ghost fol-close" onClick={() => toggle(false)}>Close</button>
            </header>
          </div>

          <div className="fol-body" ref={bodyRef} aria-live="polite">
            <div className={'fol-tip' + (tip.state === 'loading' ? ' loading' : '')} data-tip={tip.state}>
              <span className="fol-tip-eyebrow">On this screen</span>
              <span>{tip.state === 'loading' ? <span className="fol-dots" aria-label="Looking at this screen"><i /><i /><i /></span> : tip.text}</span>
              {tip.state === 'ok' && <span className="chip fol-chip-sm"><span className="dot" />{tip.live ? 'Gemini' : 'template'}{tip.cached ? ' · cached' : ''}</span>}
            </div>
            {msgs.map((m) => (
              <div key={m.id} className={'fol-msg ' + m.role + (m.state === 'error' ? ' error' : '')} data-state={m.state} style={{ '--d': m.role === 'user' ? 0 : 1 } as React.CSSProperties}>
                {m.role === 'user' ? m.text : (
                  <>
                    <p className="fol-answer">{m.state === 'streaming' && !m.text ? <span className="fol-dots" aria-label="Thinking"><i /><i /><i /></span> : <Typed text={m.text} />}</p>
                    {m.state === 'done' && m.done && (
                      <span className="fol-meta">
                        <span className="chip fol-chip-sm live"><span className="dot" />{m.done.mode === 'live' ? prettyModel(m.done.model) : 'template'}</span>
                        <span className="chip fol-chip-sm" data-filtered={m.done.dropped ? 'dropped' : 'clean'}>filtered{m.done.dropped ? ` · ${m.done.dropped} clause${m.done.dropped === 1 ? '' : 's'} removed` : ''}</span>
                      </span>
                    )}
                    {m.state === 'done' && settings.voice && <span className="fol-read"><ReadAloud text={m.text} size={bigText ? 52 : 40} label="Read aloud" /></span>}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="fol-chips" role="group" aria-label="Suggested questions">
            {chips.map((c) => <button key={c} type="button" className="fol-q" disabled={thinking} onClick={() => void send(c, c === READ_IT)}>{c}</button>)}
          </div>

          <form className="fol-input" onSubmit={(e) => { e.preventDefault(); if (thinking) stop(); else void send(input); }}>
            <span className="fol-composer">
              <button type="button" className={'fol-mic' + (listening ? ' on' : '')} onClick={mic} aria-pressed={listening} aria-label={listening ? 'Stop the browser mic' : 'Speak your question (browser mic)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
                <span className="fol-mic-lbl">{listening ? 'listening' : 'browser mic'}</span>
              </button>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={mode === 'personal' ? 'Ask in your own words' : 'Ask about this screen'} aria-label="Your question" enterKeyHint="send" />
            </span>
            <button type="submit" className={'fol-send' + (thinking ? ' stop' : '')} disabled={!thinking && !input.trim()} aria-label={thinking ? 'Stop the answer' : 'Ask'}>
              <span className="fol-send-word" aria-hidden="true">Ask</span>
              <span className="fol-send-stop" aria-hidden="true" />
            </button>
          </form>
          {micNote && <p className="fol-note" role="status">{micNote}</p>}
          <p className="fol-foot">Not medical advice. A pharmacist or doctor decides.</p>
        </section>
      )}
    </div>
  );
}
