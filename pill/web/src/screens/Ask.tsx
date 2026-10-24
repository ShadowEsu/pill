// Ask Pill. The slot for the assistant; not connected, says so, calls nothing. Replies point at the screen that answers.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';

interface Msg { id: number; who: 'pill' | 'me'; text: string; link?: { to: string; label: string } }

const HONEST = 'I can explain a result, a recall, or what a medicine is for. I’m not connected yet; the team wires me after the demo.';

function route(q: string): Msg['link'] {
  const t = q.toLowerCase();
  if (t.includes('recall')) return { to: '/medicines', label: 'Open My medicines' };
  if (t.includes('deliver') || t.includes('pay')) return { to: '/deliveries', label: 'Open Deliveries' };
  return { to: '/', label: 'Back to Home' };
}

export default function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'pill', text: HONEST }]);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: q }, { id: m.length + 1, who: 'pill', text: HONEST, link: route(q) }]);
    setDraft('');
  };

  return (
    <Screen title="Ask Pill" back="/" right={<span className="chip"><span className="dot" />AI · not connected</span>}>
      <div role="log" aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} className="rise" style={{
            alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '12px 16px', borderRadius: 18,
            background: m.who === 'me' ? 'var(--ink)' : 'var(--surface)', color: m.who === 'me' ? '#fff' : 'var(--ink)',
            border: m.who === 'me' ? 0 : '1px solid var(--line)', fontSize: '1.02rem',
            borderBottomRightRadius: m.who === 'me' ? 6 : 18, borderBottomLeftRadius: m.who === 'me' ? 18 : 6,
          }}>
            {m.who === 'pill' && <p className="eyebrow" style={{ marginBottom: 4 }}>Pill</p>}
            <p>{m.text}</p>
            {m.link && <Link to={m.link.to} style={{ display: 'inline-block', marginTop: 8, fontWeight: 600, textUnderlineOffset: 3, textDecorationColor: 'var(--sky)' }}>{m.link.label} →</Link>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} style={{ position: 'sticky', bottom: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, paddingTop: 10, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a result, a recall, a medicine" aria-label="Your question" style={{ minHeight: 56, borderRadius: 999, paddingInline: 18 }} />
        <button type="submit" className="btn" disabled={!draft.trim()} style={{ width: 'auto', paddingInline: 20 }}>Send</button>
      </form>
    </Screen>
  );
}
