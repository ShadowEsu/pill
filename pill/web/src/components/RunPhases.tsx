// The run as a timetable of the station's six phases (SOFTWARE-PLAN §2, pill/pay/src/station.ts): lights off (3 s) →
// clean water (10 s, lid closed, nothing moving) → drop (the whole tablet goes in, stirred by hand: 5 circles with the stick
// through the one hole in the lid) → dissolving → settling → verdict, proportional to time, with a pointer at t. t = 0 is the
// moment the run starts; the two pre-run phases sit at negative t. Where drop and settling end depends on the curve,
// so `marks` moves those boundaries; without marks the nominal ones below are used.
// A fault freezes the pointer where it happened and greys everything after it.
export const PHASES = [
  { key: 'dark', name: 'Lights off', short: 'dark', dur: '3 s', from: -13, to: -10, color: 'var(--navy)', status: 'lights off', doing: 'the lights are off for 3 seconds; the box has to read dark' },
  { key: 'blank', name: 'Clean water', short: 'water', dur: '10 s', from: -10, to: 0, color: 'var(--c6)', status: 'clean water', doing: 'clean water, lid closed, still; the reading has to hold steady' },
  { key: 'drop', name: 'Drop', short: 'drop', dur: '≤ 30 s', from: 0, to: 5, color: 'var(--violet)', status: 'drop the tablet', doing: 'the whole tablet goes in, 5 stirs; the inline reading has to fall 6 %' },
  { key: 'dissolve', name: 'Dissolving', short: 'dissolve', dur: '1–10 min', from: 5, to: 110, color: 'var(--c1)', status: 'dissolving', doing: 'the tablet is dissolving; both channels are being watched' },
  { key: 'settle', name: 'Settling', short: 'settle', dur: '20 s', from: 110, to: 180, color: 'var(--c4)', status: 'settling', doing: 'the reading is settling; it has to hold flat for 20 seconds' },
  { key: 'verdict', name: 'Verdict', short: 'verdict', dur: 'rules', from: 180, to: 186, color: 'var(--ink)', status: 'verdict', doing: 'the rules read the curve' },
] as const;
export type Phase = (typeof PHASES)[number];
export type PhaseKey = Phase['key'];
/** Where the curve moved the boundaries: drop detected at `drop`, settling from `settle`, run ended at `end` (seconds). */
export interface PhaseMarks { drop?: number | null; settle?: number | null; end?: number | null }

/** The phases with their boundaries moved to the marks. */
export function phaseSpans(marks: PhaseMarks = {}) {
  const drop = marks.drop ?? 5;
  const end = Math.max(drop + 1, marks.end ?? 180);
  const settle = Math.min(end, Math.max(drop, marks.settle ?? Math.min(110, end)));
  const to: Record<PhaseKey, [number, number]> = { dark: [-13, -10], blank: [-10, 0], drop: [0, drop], dissolve: [drop, settle], settle: [settle, end], verdict: [end, end + 6] };
  return PHASES.map((p) => ({ ...p, from: to[p.key][0], to: to[p.key][1] }));
}

export function phaseAt(t: number, marks?: PhaseMarks): Phase {
  const spans = phaseSpans(marks);
  const i = spans.findIndex((p) => t < p.to);
  return PHASES[i < 0 ? PHASES.length - 1 : i];
}

export const clock = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

const CSS = `
.rp-live { background-image: linear-gradient(115deg, rgba(255,255,255,.38) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.38) 50%, rgba(255,255,255,.38) 75%, transparent 75%); background-size: 14px 14px; animation: rp-stripes .8s linear infinite; }
@keyframes rp-stripes { to { background-position: 14px 0; } }
.rp-ptr { transition: left .3s linear; }
@media (prefers-reduced-motion: reduce) { .rp-live { animation: none; } }
`;

/** `t` in seconds from the run start (negative while the station reads the dark and the clean water). */
export default function RunPhases({ t, marks, fault = null, big = false, legend = true, done = false }: {
  t: number; marks?: PhaseMarks; fault?: number | null; big?: boolean; legend?: boolean;
  /** the verdict is in */ done?: boolean;
}) {
  const spans = phaseSpans(marks);
  const lo = spans[0].from, hi = spans.at(-1)!.to;
  const at = done ? hi : Math.max(lo, Math.min(hi, fault ?? t));
  const share = (at - lo) / (hi - lo);
  const now = phaseAt(at, marks);
  const stopped = fault != null;
  const pointer = stopped ? `stopped at ${clock(at)}` : done ? 'verdict in' : at < 0 ? `t − ${Math.ceil(-at)} s · ${now.name.toLowerCase()}` : `${clock(at)} since the run started`;
  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label={`Run timetable: ${now.name}${at >= 0 ? `, ${clock(at)}` : ''}${stopped ? ', stopped' : ''}`}>
      <style href="pm-runphases" precedence="pm">{CSS}</style>
      <div style={{ position: 'relative', height: big ? 18 : 14 }}>
        <span className="rp-ptr mono" aria-hidden="true" style={{ position: 'absolute', left: `${share * 100}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: big ? 16 : 12, lineHeight: 1, color: stopped ? 'var(--grey)' : 'var(--ink)' }}>▼</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: big ? 16 : 12 }}>
        {spans.map((p) => {
          const fill = Math.max(0, Math.min(1, (at - p.from) / (p.to - p.from)));
          const lost = stopped && p.to > at;
          const current = p.key === now.key && !stopped && !done;
          return (
            <div key={p.key} style={{ flex: `${Math.max(2, p.to - p.from)} 0 0`, minWidth: 6, position: 'relative', borderRadius: 4, overflow: 'hidden', background: lost ? 'var(--grey-tint)' : `color-mix(in srgb, ${p.color} 22%, transparent)` }}>
              <div className={current ? 'rp-live' : undefined} style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, backgroundColor: p.color, transition: 'width .3s linear' }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        <span className="rp-ptr mono" style={{ position: 'absolute', left: `${share * 100}%`, top: 0, transform: `translateX(-${share * 100}%)`, fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{pointer}</span>
      </div>
      {legend ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 6 }}>
          {spans.map((p) => {
            const state = stopped && p.to > at ? 'stopped' : at >= p.to || (done && p.key !== 'verdict') ? 'done' : p.key === now.key ? 'now' : 'next';
            return (
              <li key={p.key} aria-current={state === 'now' ? 'step' : undefined} style={{ padding: '6px 8px', borderRadius: 10, minWidth: 0, background: state === 'now' ? 'var(--sky-tint)' : 'transparent', border: '1px solid ' + (state === 'now' ? 'rgba(79,179,255,.35)' : 'var(--line)') }}>
                <span style={{ display: 'block', width: 14, height: 3, borderRadius: 2, background: state === 'stopped' ? 'var(--grey)' : p.color, marginBottom: 4 }} />
                <span style={{ display: 'block', fontSize: big ? 15 : 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span className="mono muted" style={{ display: 'block', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.key === 'verdict' ? 'rules' : p.from < 0 ? p.dur : `${clock(p.from)}–${clock(p.to)}`}</span>
                <span className="mono" style={{ display: 'block', fontSize: 10.5, color: state === 'now' ? 'var(--ink)' : 'var(--muted)' }}>{state}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="row" style={{ listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', gap: '4px 16px' }}>
          {spans.map((p) => (
            <li key={p.key} className="row mono" aria-current={p.key === now.key && !stopped ? 'step' : undefined} style={{ gap: 6, fontSize: 12, color: p.key === now.key && !stopped ? 'var(--ink)' : 'var(--muted)', fontWeight: p.key === now.key && !stopped ? 600 : 400 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: stopped && p.to > at ? 'var(--grey)' : p.color }} />{p.name.toLowerCase()} {p.dur}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
