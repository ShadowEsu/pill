// Who did what, named, as one vertical timeline grouped by time ("This morning", "Yesterday", …). Medical: every line.
// Personal: my bottles' lines (incl. my dose log) and the station. Lines that point at something open it.
// Motion: the timeline's line grows with the scroll; each line slides in and draws its icon as it enters the view.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import ActorAvatar from '../components/ActorAvatar';
import Glyph, { type GlyphName } from '../components/Glyph';
import { useStore } from '../lib/store';
import { useReducedMotion } from '../lib/motion';
import { PEOPLE } from '../data/history';
import { myBottles } from '../lib/doses';
import type { Activity as Line } from '../lib/types';
import { DAY, dayLabel, dayStart, hm, refTo, useNow } from '../lib/when';
import '../components/viz.css';
import '../story.css';

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
const KIND_C: Record<Line['kind'], string> = { money: 'var(--cb)', hold: 'var(--warm)', ok: 'var(--mint)', info: 'var(--line-2)' };

/** The icon for a line: what happened first (run, dose, scan, calibration, money), else who did it. */
function glyphOf(a: Line): GlyphName {
  const t = a.text;
  if (t.startsWith('calibrated')) return 'sensor';
  if (/started run|finished run/.test(t)) return 'cup';
  if (t.startsWith('took ')) return 'tablet';
  if (t.startsWith('scanned') || t.includes('label')) return 'bottle';
  if (a.actor === 'Google Calendar' || t.includes('Calendar')) return 'calendar';
  if (a.kind === 'money' || a.actor === PEOPLE.cdp || a.actor === PEOPLE.nessie) return 'wallet';
  if (a.actor === PEOPLE.agent) return 'escrow';
  if (a.actor === PEOPLE.openfda) return 'lab';
  if (a.actor === PEOPLE.claude) return 'led';
  if (a.actor === PEOPLE.station) return 'station';
  if (a.actor === PEOPLE.pharmacist || a.actor === PEOPLE.tech) return 'pharmacist';
  return 'clinic';
}

/** "This morning" / "This afternoon" / "This evening" for today, "Yesterday", then the day's name. */
function timeGroup(at: number, now: number) {
  if (at >= dayStart(now)) {
    const h = new Date(at).getHours();
    return h < 12 ? 'This morning' : h < 18 ? 'This afternoon' : 'This evening';
  }
  if (at >= dayStart(now) - DAY) return 'Yesterday';
  return dayLabel(at, now);
}

/** One timeline line: mounts hidden, slides in and draws its icon the first time it scrolls into view. */
function Item({ a, i }: { a: Line; i: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(reduce);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const to = refTo(a.ref);
  const body = (
    <>
      <ActorAvatar actor={a.actor} />
      <span className="tl-text"><b>{a.actor}</b> {a.text}{to && <span className="feed-go" aria-hidden="true">→</span>}</span>
      <span className="tl-time" title={KIND_WORD[a.kind]}>{hm(a.at)}</span>
    </>
  );
  return (
    <li ref={ref} className={'tl-item' + (seen ? ' in' : '')} style={{ '--kc': KIND_C[a.kind], '--d': `${(i % 6) * 50}ms` } as React.CSSProperties}>
      <span className="tl-node" aria-hidden="true">{seen && <Glyph name={glyphOf(a)} size={26} />}</span>
      {to ? <Link to={to} className="tl-card" data-ref={a.ref?.kind}>{body}</Link> : <div className="tl-card">{body}</div>}
    </li>
  );
}

export default function Activity() {
  const mode = useStore((s) => s.mode);
  const acts = useStore((s) => s.activities);
  const bottles = useStore((s) => s.bottles);
  const deliveries = useStore((s) => s.deliveries);
  const now = useNow();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Group>('all');
  const tl = useRef<HTMLDivElement>(null);
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
  const groups: { label: string; items: Line[] }[] = [];
  for (const a of shown) {
    const label = timeGroup(a.at, now);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)!.items.push(a);
  }
  const actors = new Set(shown.map((a) => a.actor)).size;

  // the spine grows with the scroll: --p is how much of the timeline has passed the bottom of the view
  useEffect(() => {
    const el = tl.current;
    if (!el) return;
    if (reduce) { el.style.setProperty('--p', '1'); return; }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.9 - r.top) / Math.max(1, r.height)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [reduce, filter, shown.length]);

  return (
    <Screen title="Activity" tone="mint" eyebrow={personal ? 'my medicines · the station' : `${lines.length} lines · who did what`}
      art={<span className="runs-art" aria-hidden="true"><Glyph name="pharmacist" size={50} /><Glyph name="station" size={40} delay={200} /></span>}>
      <div className="filters slide-filters" role="group" aria-label="Filter by who">
        {FILTERS.filter((f) => count(f.k) > 0 || f.k === 'all').map((f) => (
          <button key={f.k} type="button" className="chip" aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>{f.label} <span className="fcount">{count(f.k)}</span></button>
        ))}
      </div>
      <p className="tl-legend mono muted">{shown.length} lines · {actors} {actors === 1 ? 'actor' : 'actors'} · <i style={{ background: 'var(--cb)' }} /> money <i style={{ background: 'var(--warm)' }} /> hold <i style={{ background: 'var(--mint)' }} /> done</p>

      {groups.length === 0 && <div className="card" style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: 28 }}><Glyph name="clinic" size={64} /><p className="muted">Nothing here yet.</p></div>}
      <div ref={tl} key={filter} className="tl">
        <span className="tl-spine" aria-hidden="true" />
        {groups.map((g) => (
          <section key={g.label} className="tl-group" aria-label={g.label}>
            <h2 className="tl-head"><span className="serif">{g.label}</span><span className="eyebrow">{g.items.length} lines</span></h2>
            <ol className="tl-list">
              {g.items.map((a, i) => <Item key={a.id} a={a} i={i} />)}
            </ol>
          </section>
        ))}
      </div>
    </Screen>
  );
}
