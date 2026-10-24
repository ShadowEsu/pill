// Ask Pill, connected to Claude through the pill-pay service (POST /ask). The app builds a compact record from the
// store (runs, deliveries, recalls, the band; in personal mode medicines and reminders), shows it in "What Pill knows",
// and sends exactly that. The service answers only from it, runs the clause filter, and says which model answered.
// Motion: messages slide in from their side, the spinning pill is the assistant's avatar, three dots while waiting.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import SpinPill from '../components/SpinPill';
import ReadAloud from '../components/ReadAloud';
import { useMediaQuery, useReducedMotion } from '../lib/motion';
import { getState, useStore, type State } from '../lib/store';
import { PAY_URL, askPill, type AskAnswer } from '../lib/api';
import { playSound } from '../lib/sound';
import { myBottles, takenToday } from '../lib/doses';
import { REFERENCES } from '../data/reference';
import { atClock, hm } from '../lib/when';
import type { Mode } from '../lib/types';

interface Msg { id: number; who: 'pill' | 'me'; text: string; meta?: AskAnswer | { mode: 'unavailable'; error: string }; links?: { to: string; label: string }[] }

const SUGGEST: Record<Mode, string[]> = {
  medical: ['Which lots this week were held and why?', 'What does NEEDS LAB mean for lot TM-02?', 'Did any supplier have two holds?', 'Read me today\u2019s plan'],
  personal: ['What do I take tonight?', 'Why did my last test say NEEDS LAB?', 'Can I take two?', 'Add a reminder'],
};
const HELLO: Record<Mode, string> = {
  medical: 'Ask about runs, lots, deliveries and holds. I answer only from Pill\u2019s record (open “What Pill knows”) and the seven rules. I can\u2019t say a medicine is fine to use, and I never release money: only a pharmacist\u2019s tap does.',
  personal: 'Ask about your medicines, your reminders and your tests. I answer only from what Pill has recorded. I can\u2019t tell you whether or how much to take: that is a question for your pharmacist.',
};

const when = (t: number) => new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

interface RunOut { id: string; lot: string; drug: string; at: string; verdict: string; rule: string | null; pct: number | null; plateau: number | null; glowRise: number | null }
/** The compact record sent with every question; the other keys depend on the mode (see buildContext). */
interface AskContext {
  now: string;
  reference: { drug: string; band: [number, number]; glow_min: number; scatter_max: number; reference_runs: number; cv_pct: number } | null;
  runs: RunOut[];
  [key: string]: unknown;
}

/** The compact record sent with every question. Same object the "What Pill knows" card shows. */
function buildContext(s: State, mode: Mode): AskContext {
  const now = Date.now();
  const ref = s.station.reference ? REFERENCES[s.station.reference] : null;
  const reference: AskContext['reference'] = ref ? { drug: ref.drug, band: [ref.bandLow, ref.bandHigh], glow_min: ref.glowMin, scatter_max: ref.scatterMax, reference_runs: ref.runs, cv_pct: ref.cv } : null;
  const runOut = (r: State['runs'][number]): RunOut => ({ id: r.id, lot: r.lot, drug: r.drug, at: when(r.startedAt), verdict: r.evaluation?.verdict ?? 'running', rule: r.evaluation?.rule ?? null, pct: r.evaluation?.pct ?? null, plateau: r.evaluation?.plateau ?? null, glowRise: r.evaluation?.glowRise ?? null });
  if (mode === 'personal') {
    const mine = myBottles(s.bottles, s.deliveries);
    const ids = new Set(mine.map((b) => b.runId).filter(Boolean));
    return {
      now: when(now), reference,
      medicines: mine.map((b) => ({ drug: b.drug, strength: b.strength, lot: b.lot, maker: b.maker, expiry: b.expiry, used_for: b.usedFor, recall: b.recall, tested_run: b.runId, reminder: b.reminder, taken_today: takenToday(b, now).map(hm), last_taken: b.takenAt[0] ? when(b.takenAt[0]) : null })),
      schedule: mine.filter((b) => b.reminder).sort((x, y) => x.reminder!.localeCompare(y.reminder!)).map((b) => ({ time: b.reminder, drug: `${b.drug} ${b.strength}`, status: takenToday(b, now).length ? 'taken today' : atClock(b.reminder!, now) < now ? 'missed today' : 'planned' })),
      runs: s.runs.filter((r) => ids.has(r.id) || r.mode === 'personal').slice(0, 10).map(runOut),
    };
  }
  const logged = (d: State['deliveries'][number]) => d.log[0]?.at ?? 0;
  return {
    now: when(now), reference, station: { id: s.station.id, calibrated: s.station.calibratedAt ? when(s.station.calibratedAt) : null },
    runs: s.runs.slice(0, 10).map(runOut),
    deliveries: s.deliveries.map((d) => ({ id: d.id, supplier: d.supplier, lot: d.lot, drug: d.drug, amount: d.amountUsd, outcome: d.outcome, clause: d.clause, run: d.runId, logged: when(logged(d)) })),
    recalls_seen: s.bottles.filter((b) => b.recall === 'recall').map((b) => ({ lot: b.lot, drug: b.drug })),
    today_plan: s.deliveries.filter((d) => d.outcome === 'pending').map((d) => ({ delivery: d.id, lot: d.lot, supplier: d.supplier, amount: d.amountUsd, next: d.runId ? 'run policy' : 'test one tablet' })),
  };
}

/** Run and delivery ids the answer names become links; a reminder answer points at My medicines. */
function linksFor(text: string, s: State): Msg['links'] {
  const out: { to: string; label: string }[] = [];
  for (const id of new Set(text.match(/\br-[\w]+\b/g) ?? [])) if (s.runs.some((r) => r.id === id && r.evaluation)) out.push({ to: `/evaluation/${id}`, label: `Open run ${id}` });
  for (const id of new Set(text.match(/\bd-\d+\b/g) ?? [])) if (s.deliveries.some((d) => d.id === id)) out.push({ to: `/delivery/${id}`, label: `Open delivery ${id}` });
  if (/reminder/i.test(text)) out.push({ to: '/medicines', label: 'Open My medicines' });
  return out.slice(0, 3);
}

const bubble = (me: boolean): React.CSSProperties => ({
  maxWidth: me ? '86%' : 'calc(100% - 66px)', padding: '12px 16px', borderRadius: 18, minWidth: 0,
  background: me ? 'var(--ink)' : 'var(--surface)', color: me ? '#fff' : 'var(--ink)',
  border: me ? 0 : '1px solid var(--line)', fontSize: '1.02rem',
  borderBottomRightRadius: me ? 6 : 18, borderBottomLeftRadius: me ? 18 : 6,
});

function ModelChip({ meta }: { meta: NonNullable<Msg['meta']> }) {
  if (meta.mode === 'unavailable') return <span className="chip warn" title={meta.error}><span className="dot" />not connected</span>;
  const drop = meta.dropped.length ? ` · ${meta.dropped.length} dropped` : '';
  return meta.mode === 'live'
    ? <span className="chip ok" data-model="claude" title={`${meta.model_id ?? 'claude'}; every clause passed the word filter${drop}`}><span className="dot" />claude · filtered{drop}</span>
    : <span className="chip warn" data-model="template" title={meta.reason}><span className="dot" />template{drop}</span>;
}

function Knows({ ctx: c, mode, open }: { ctx: AskContext; mode: Mode; open: boolean }) {
  const ref = c.reference;
  const lines: string[] = mode === 'medical'
    ? [
        `${c.runs.length} latest runs: ${c.runs.map((r) => `${r.lot} ${r.verdict}${r.rule ? ` ${r.rule}` : ''}`).join(' · ')}`,
        `${(c.deliveries as unknown[]).length} deliveries with supplier, lot, amount, outcome and clause`,
        `Recalls seen: ${(c.recalls_seen as { lot: string }[]).map((r) => r.lot).join(', ') || 'none'}`,
        `Today: ${(c.today_plan as { lot: string }[]).map((p) => p.lot).join(', ') || 'nothing pending'} pending`,
      ]
    : [
        `${(c.medicines as unknown[]).length} medicines with lot, maker, expiry, recall and today\u2019s doses`,
        `Reminders: ${(c.schedule as { time: string; drug: string; status: string }[]).map((x) => `${x.time} ${x.drug} (${x.status})`).join(' · ') || 'none'}`,
        `${c.runs.length} tests: ${c.runs.map((r) => `${r.lot} ${r.verdict}`).join(' · ') || 'none'}`,
      ];
  return (
    <details className="card" open={open} style={{ padding: '12px 16px' }} data-knows>
      <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', listStyle: 'none' }}>
        <span style={{ fontWeight: 600 }}>What Pill knows</span>
        <span className="mono muted" style={{ fontSize: 12 }}>sent with every question</span>
      </summary>
      <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14, color: 'var(--ink-2)' }}>
        {ref && <li>Reference band {ref.drug} {ref.band[0]}–{ref.band[1]}, glow minimum {ref.glow_min}, {ref.reference_runs} runs, CV {ref.cv_pct} %</li>}
        {lines.map((l) => <li key={l} style={{ overflowWrap: 'anywhere' }}>{l}</li>)}
        <li>The seven rules (U1–P1) and the payment policy (P1–P6), quoted on the service</li>
      </ul>
      <details style={{ marginTop: 10 }}>
        <summary className="mono" style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>the exact JSON ({JSON.stringify(c).length.toLocaleString('en-US')} characters)</summary>
        <pre className="mono" style={{ fontSize: 11, maxHeight: 260, overflow: 'auto', background: 'var(--bg)', padding: 10, borderRadius: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0 0' }}>{JSON.stringify(c, null, 1)}</pre>
      </details>
      <p className="footnote" style={{ marginTop: 10 }}>Nothing else leaves the app. Answers pass a word filter before you see them.</p>
    </details>
  );
}

export default function Ask() {
  const reduce = useReducedMotion();
  const wide = useMediaQuery('(min-width: 900px)');
  const mode: Mode = useStore((s) => s.mode) ?? 'personal';
  const state = useStore((s) => s);
  const ctx = useMemo(() => buildContext(state, mode), [state, mode]);
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 0, who: 'pill', text: HELLO[mode] }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (msgs.length > 1 || thinking) end.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' }); }, [msgs, thinking, reduce]);

  const send = async (q: string) => {
    q = q.trim();
    if (!q || thinking) return;
    playSound('tap');
    setDraft('');
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: q }]);
    setThinking(true);
    const r = await askPill(q, mode, ctx);
    if (!alive.current) return;
    setThinking(false);
    const reply: Msg = r.mode === 'unavailable'
      ? { id: 0, who: 'pill', text: PAY_URL ? `The Pill service did not answer (${r.error}). Nothing was sent to Claude.` : 'Ask Pill needs the pill-pay service (VITE_PAY_URL). Nothing was sent anywhere.', meta: { mode: 'unavailable', error: r.error } }
      : { id: 0, who: 'pill', text: r.answer, meta: r, links: linksFor(r.answer, getState()) };
    setMsgs((m) => [...m, { ...reply, id: m.length }]);
  };

  const chat = (
    <div className="stack" style={{ gap: 12, minWidth: 0 }}>
      <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} className={'ask-row' + (m.who === 'me' ? ' me' : '')} style={{ '--i': m.id === 0 ? 2 : 0 } as React.CSSProperties}>
            {m.who === 'pill' && <SpinPill size={56} speed={m.id === msgs.length - 1 ? 1.6 : 0.8} label="Pill" />}
            <div style={bubble(m.who === 'me')} data-answer={m.who === 'pill' && m.meta ? m.meta.mode : undefined}>
              {m.who === 'pill' && (
                <div className="row between" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <p className="eyebrow">Pill</p>
                  {m.meta && <ModelChip meta={m.meta} />}
                </div>
              )}
              <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{m.text}</p>
              {m.links && m.links.length > 0 && (
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  {m.links.map((l) => <Link key={l.to} to={l.to} style={{ fontWeight: 600, textUnderlineOffset: 3, textDecorationColor: 'var(--sky)' }}>{l.label} →</Link>)}
                </div>
              )}
              {m.who === 'pill' && m.meta && m.meta.mode !== 'unavailable' && <div style={{ marginTop: 10 }}><ReadAloud text={m.text} size={40} /></div>}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="ask-row" role="status" aria-label="Pill is replying">
            <SpinPill size={56} speed={2.4} label="Pill" />
            <div style={bubble(false)}><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span></div>
          </div>
        )}
        <div ref={end} />
      </div>
      {/* on phones the tab bar is sticky too; sit the composer just above it */}
      <div style={{ position: 'sticky', bottom: wide ? 0 : 'calc(62px + env(safe-area-inset-bottom))', paddingTop: 10, paddingBottom: wide ? 8 : 8, background: 'linear-gradient(180deg, transparent, var(--bg) 24%)', display: 'grid', gap: 10 }}>
        <div className="row" role="group" aria-label="Suggested questions" style={{ gap: 8, flexWrap: 'wrap' }}>
          {SUGGEST[mode].map((q) => (
            <button key={q} type="button" className="chip" disabled={thinking} onClick={() => void send(q)} style={{ cursor: 'pointer', minHeight: 36, background: 'var(--surface)' }}>{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(draft); }} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder={mode === 'medical' ? 'Ask about a run, a lot, a hold' : 'Ask about a medicine, a reminder, a test'} aria-label="Your question" style={{ minHeight: 56, borderRadius: 999, paddingInline: 18, minWidth: 0 }} />
          <button type="submit" className="btn" disabled={!draft.trim() || thinking} style={{ width: 'auto', paddingInline: 20 }}>Send</button>
        </form>
      </div>
    </div>
  );

  return (
    <Screen title="Ask Pill" eyebrow={mode === 'medical' ? 'for the clinic pharmacist' : 'for you at home'} back="/" right={<span className={'chip ' + (PAY_URL ? 'ok' : 'warn')}><span className="dot" />{PAY_URL ? 'claude · filtered' : 'not connected'}</span>}>
      {wide
        ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>{chat}<div style={{ position: 'sticky', top: 16 }}><Knows ctx={ctx} mode={mode} open /></div></div>
        : <><Knows ctx={ctx} mode={mode} open={false} />{chat}</>}
    </Screen>
  );
}
