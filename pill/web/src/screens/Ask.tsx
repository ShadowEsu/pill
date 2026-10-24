// Ask Pill. The slot for the assistant; not connected, says so, calls nothing. Replies point at the screen that answers.
// Motion: messages slide in from their side, the spinning pill is the assistant's avatar, three dots before each reply.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import SpinPill from '../components/SpinPill';
import { useMediaQuery, useReducedMotion } from '../lib/motion';

interface Msg { id: number; who: 'pill' | 'me'; text: string; link?: { to: string; label: string } }

const HONEST = 'I can explain a result, a recall, or what a medicine is for. I’m not connected yet; the team wires me after the demo.';
const THINK_MS = 900;

function route(q: string): Msg['link'] {
  const t = q.toLowerCase();
  if (t.includes('recall')) return { to: '/medicines', label: 'Open My medicines' };
  if (t.includes('deliver') || t.includes('pay')) return { to: '/deliveries', label: 'Open Deliveries' };
  return { to: '/', label: 'Back to Home' };
}

const bubble = (me: boolean): React.CSSProperties => ({
  maxWidth: me ? '86%' : 'calc(100% - 66px)', padding: '12px 16px', borderRadius: 18,
  background: me ? 'var(--ink)' : 'var(--surface)', color: me ? '#fff' : 'var(--ink)',
  border: me ? 0 : '1px solid var(--line)', fontSize: '1.02rem',
  borderBottomRightRadius: me ? 6 : 18, borderBottomLeftRadius: me ? 18 : 6,
});

export default function Ask() {
  const reduce = useReducedMotion();
  const wide = useMediaQuery('(min-width: 900px)');
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'pill', text: HONEST }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' }); }, [msgs, thinking, reduce]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || thinking) return;
    setDraft('');
    const reply = (m: Msg[]): Msg[] => [...m, { id: m.length, who: 'pill', text: HONEST, link: route(q) }];
    if (reduce) { setMsgs((m) => reply([...m, { id: m.length, who: 'me', text: q }])); return; }
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: q }]);
    setThinking(true);
    timer.current = window.setTimeout(() => { setThinking(false); setMsgs(reply); }, THINK_MS);
  };

  return (
    <Screen title="Ask Pill" back="/" right={<span className="chip"><span className="dot" />AI · not connected</span>}>
      <div role="log" aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} className={'ask-row' + (m.who === 'me' ? ' me' : '')} style={{ '--i': m.id === 0 ? 2 : 0 } as React.CSSProperties}>
            {m.who === 'pill' && <SpinPill size={56} speed={m.id === msgs.length - 1 ? 1.6 : 0.8} label="Pill" />}
            <div style={bubble(m.who === 'me')}>
              {m.who === 'pill' && <p className="eyebrow" style={{ marginBottom: 4 }}>Pill</p>}
              <p>{m.text}</p>
              {m.link && <Link to={m.link.to} style={{ display: 'inline-block', marginTop: 8, fontWeight: 600, textUnderlineOffset: 3, textDecorationColor: 'var(--sky)' }}>{m.link.label} →</Link>}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="ask-row" role="status" aria-label="Pill is replying">
            <SpinPill size={56} speed={2.4} label="Pill" />
            <div style={bubble(false)}>
              <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      {/* on phones the tab bar is sticky too; sit the composer just above it */}
      <form onSubmit={send} style={{ position: 'sticky', bottom: wide ? 0 : 'calc(62px + env(safe-area-inset-bottom))', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, paddingTop: 10, paddingBottom: wide ? 0 : 8, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a result, a recall, a medicine" aria-label="Your question" style={{ minHeight: 56, borderRadius: 999, paddingInline: 18 }} />
        <button type="submit" className="btn" disabled={!draft.trim() || thinking} style={{ width: 'auto', paddingInline: 20 }}>Send</button>
      </form>
    </Screen>
  );
}
