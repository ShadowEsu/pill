// Who did what, named, grouped by day. Medical: every line. Personal: my bottles' lines (incl. my dose log) and the station.
// Lines that point at something open it: run → evaluation, delivery → delivery, bottle → medicines.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import ActorAvatar from '../components/ActorAvatar';
import { useStore } from '../lib/store';
import { PEOPLE } from '../data/history';
import { myBottles } from '../lib/doses';
import type { Activity as Line } from '../lib/types';
import { dayLabel, dayStart, hm, refTo } from '../lib/when';
import '../components/viz.css';

type Group = 'all' | 'people' | 'station' | 'agent' | 'services';
const GROUP_OF: Record<string, Group> = {
  [PEOPLE.pharmacist]: 'people', [PEOPLE.tech]: 'people', [PEOPLE.you]: 'people',
  [PEOPLE.station]: 'station',
  [PEOPLE.agent]: 'agent', [PEOPLE.claude]: 'agent',
  [PEOPLE.openfda]: 'services', [PEOPLE.cdp]: 'services', [PEOPLE.nessie]: 'services',
};
const FILTERS: { k: Group; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'people', label: 'People' }, { k: 'station', label: 'Station' }, { k: 'agent', label: 'Agent' }, { k: 'services', label: 'Services' },
];
const KIND_WORD: Record<Line['kind'], string> = { money: 'money', hold: 'hold', ok: 'done', info: 'note' };

export default function Activity() {
  const mode = useStore((s) => s.mode);
  const acts = useStore((s) => s.activities);
  const bottles = useStore((s) => s.bottles);
  const deliveries = useStore((s) => s.deliveries);
  const [filter, setFilter] = useState<Group>('all');
  const personal = mode === 'personal';

  let lines = acts;
  if (personal) {
    const mine = myBottles(bottles, deliveries);
    const ids = new Set(mine.map((b) => b.id));
    lines = acts.filter((a) => a.actor === PEOPLE.station || a.actor === PEOPLE.you || (a.ref?.kind === 'bottle' && ids.has(a.ref.id)));
    // the dose log is the record; show each dose as a line unless "took …" was already logged for it
    const doses: Line[] = mine.flatMap((b) => b.takenAt
      .filter((t) => !acts.some((a) => a.ref?.id === b.id && a.actor === PEOPLE.you && Math.abs(a.at - t) < 60e3))
      .map((t) => ({ id: `dose-${b.id}-${t}`, at: t, actor: PEOPLE.you, text: `took ${b.drug} ${b.strength}`, kind: 'ok' as const, ref: { kind: 'bottle' as const, id: b.id } })));
    lines = [...lines, ...doses].sort((x, y) => y.at - x.at);
  }
  const groupOf = (a: Line) => GROUP_OF[a.actor] ?? 'services';
  const count = (g: Group) => (g === 'all' ? lines.length : lines.filter((a) => groupOf(a) === g).length);
  const shown = filter === 'all' ? lines : lines.filter((a) => groupOf(a) === filter);
  const days: { day: number; items: Line[] }[] = [];
  for (const a of shown) {
    const d = dayStart(a.at);
    if (days.at(-1)?.day !== d) days.push({ day: d, items: [] });
    days.at(-1)!.items.push(a);
  }
  const actors = new Set(shown.map((a) => a.actor)).size;

  return (
    <Screen title="Activity" eyebrow={personal ? 'my medicines · the station' : `${lines.length} lines · who did what`}>
      <div className="filters" role="group" aria-label="Filter by who">
        {FILTERS.filter((f) => count(f.k) > 0 || f.k === 'all').map((f) => (
          <button key={f.k} type="button" className="chip" aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>{f.label} <span style={{ opacity: .6 }}>{count(f.k)}</span></button>
        ))}
      </div>
      <p className="mono muted" style={{ fontSize: 12 }}>{shown.length} lines · {actors} {actors === 1 ? 'actor' : 'actors'} · <span style={{ color: 'var(--cb)' }}>■</span> money <span style={{ color: 'var(--warm)' }}>■</span> hold <span style={{ color: 'var(--mint)' }}>■</span> done</p>

      {days.length === 0 && <p className="card muted">Nothing here yet.</p>}
      <div className="wide-2" style={{ alignItems: 'start' }}>
        {days.map((g, gi) => (
          <section key={g.day} className="card panel rise" style={{ animationDelay: `${Math.min(gi, 5) * 60}ms`, padding: '14px 16px' }} aria-label={dayLabel(g.day)}>
            <div className="panel-head"><h2>{dayLabel(g.day)}</h2><span className="eyebrow">{g.items.length} lines</span></div>
            <ul className="feed">
              {g.items.map((a) => {
                const to = refTo(a.ref);
                const body = (
                  <>
                    <ActorAvatar actor={a.actor} />
                    <span className="feed-text" style={{ WebkitLineClamp: 'unset', display: 'block' }}><b>{a.actor}</b> {a.text}{to && <span className="feed-go" aria-hidden="true">→</span>}</span>
                    <span className="feed-time" title={KIND_WORD[a.kind]}>{hm(a.at)}</span>
                  </>
                );
                return <li key={a.id}>{to ? <Link to={to} className={'feed-line k-' + a.kind} data-ref={a.ref?.kind}>{body}</Link> : <div className={'feed-line k-' + a.kind}>{body}</div>}</li>;
              })}
            </ul>
          </section>
        ))}
      </div>
    </Screen>
  );
}
