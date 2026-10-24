// The run as a timetable: fill → dissolve → settle → hold, proportional to time, with a pointer at t.
// A fault freezes the pointer where it happened and greys everything after it.
export const PHASES = [
  { key: 'fill', from: 0, to: 5, color: 'var(--c6)', status: 'filling the chamber', doing: 'the quarter tablet is breaking up' },
  { key: 'dissolve', from: 5, to: 110, color: 'var(--c1)', status: 'dissolving', doing: 'the tablet is dissolving; both channels are being watched' },
  { key: 'settle', from: 110, to: 165, color: 'var(--c4)', status: 'settling', doing: 'the reading is settling; the band is near' },
  { key: 'hold', from: 165, to: 180, color: 'var(--c2)', status: 'holding', doing: 'holding to confirm the plateau' },
] as const;
export type Phase = (typeof PHASES)[number];

export function phaseAt(t: number): Phase {
  return PHASES.find((p) => t < p.to) ?? PHASES[PHASES.length - 1];
}

export const clock = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

const CSS = `
.rp-live { background-image: linear-gradient(115deg, rgba(255,255,255,.38) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.38) 50%, rgba(255,255,255,.38) 75%, transparent 75%); background-size: 14px 14px; animation: rp-stripes .8s linear infinite; }
@keyframes rp-stripes { to { background-position: 14px 0; } }
.rp-ptr { transition: left .3s linear; }
@media (prefers-reduced-motion: reduce) { .rp-live { animation: none; } }
`;

export default function RunPhases({ t, total = 180, fault = null, big = false, legend = true }: { t: number; total?: number; fault?: number | null; big?: boolean; legend?: boolean }) {
  const at = Math.max(0, Math.min(total, fault ?? t));
  const share = at / total;
  const now = phaseAt(at);
  const stopped = fault != null;
  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label={`Run timetable: ${now.key}, ${clock(at)} of ${clock(total)}${stopped ? ', stopped' : ''}`}>
      <style href="pm-runphases" precedence="pm">{CSS}</style>
      <div style={{ position: 'relative', height: big ? 18 : 14 }}>
        <span className="rp-ptr mono" aria-hidden="true" style={{ position: 'absolute', left: `${share * 100}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: big ? 16 : 12, lineHeight: 1, color: stopped ? 'var(--grey)' : 'var(--ink)' }}>▼</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: big ? 16 : 12 }}>
        {PHASES.map((p) => {
          const done = Math.max(0, Math.min(1, (at - p.from) / (p.to - p.from)));
          const lost = stopped && p.to > at;
          const current = p === now && !stopped && t < total;
          return (
            <div key={p.key} style={{ flex: `${p.to - p.from} 0 0`, minWidth: 4, position: 'relative', borderRadius: 4, overflow: 'hidden', background: lost ? 'var(--grey-tint)' : `color-mix(in srgb, ${p.color} 22%, transparent)` }}>
              <div className={current ? 'rp-live' : undefined} style={{ position: 'absolute', inset: 0, width: `${done * 100}%`, backgroundColor: p.color, transition: 'width .3s linear' }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        <span className="rp-ptr mono" style={{ position: 'absolute', left: `${share * 100}%`, top: 0, transform: `translateX(-${share * 100}%)`, fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          {stopped ? `stopped at ${clock(at)}` : `${clock(at)} elapsed · ${clock(total - at)} left`}
        </span>
      </div>
      {legend ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 6 }}>
          {PHASES.map((p) => {
            const state = stopped && p.to > at ? 'stopped' : at >= p.to ? 'done' : p === now ? 'now' : 'next';
            return (
              <li key={p.key} aria-current={state === 'now' ? 'step' : undefined} style={{ padding: '6px 8px', borderRadius: 10, minWidth: 0, background: state === 'now' ? 'var(--sky-tint)' : 'transparent', border: '1px solid ' + (state === 'now' ? 'rgba(79,179,255,.35)' : 'var(--line)') }}>
                <span style={{ display: 'block', width: 14, height: 3, borderRadius: 2, background: state === 'stopped' ? 'var(--grey)' : p.color, marginBottom: 4 }} />
                <span style={{ display: 'block', fontSize: big ? 15 : 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.key}</span>
                <span className="mono muted" style={{ display: 'block', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clock(p.from)}–{clock(p.to)}</span>
                <span className="mono" style={{ display: 'block', fontSize: 10.5, color: state === 'now' ? 'var(--ink)' : 'var(--muted)' }}>{state}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="row" style={{ listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', gap: '4px 16px' }}>
          {PHASES.map((p) => (
            <li key={p.key} className="row mono" aria-current={p === now && !stopped ? 'step' : undefined} style={{ gap: 6, fontSize: 12, color: p === now && !stopped ? 'var(--ink)' : 'var(--muted)', fontWeight: p === now && !stopped ? 600 : 400 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: stopped && p.to > at ? 'var(--grey)' : p.color }} />{p.key} {clock(p.from)}–{clock(p.to)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
