// Verdicts handed over by the Pill Gate station app (pill-pay GET /gate/station-scans). A record only: these never change a
// delivery's verdict, policy clause or money. Polled every 5 s while a screen that shows them is mounted.
import { useEffect, useState } from 'react';
import VerdictChip from './VerdictChip';
import { PAY_URL, stationScans, type StationScan } from '../lib/api';

const time = (ms: number) => new Date(ms).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** null while the first answer is pending; `error` when the service is not reachable. */
export function useStationScans(): { scans: StationScan[] | null; error: string | null } {
  const [state, setState] = useState<{ scans: StationScan[] | null; error: string | null }>({ scans: null, error: PAY_URL ? null : 'no VITE_PAY_URL' });
  useEffect(() => {
    if (!PAY_URL) return;
    let alive = true;
    const load = () => void stationScans().then((r) => { if (alive) setState(Array.isArray(r) ? { scans: r, error: null } : (s) => ({ scans: s.scans, error: r.error })); });
    load();
    const id = window.setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return state;
}

/** Deliveries: the "From the station" strip. */
export default function StationStrip() {
  const { scans, error } = useStationScans();
  return (
    <section className="card panel" aria-label="From the station" data-station-strip>
      <div className="panel-head"><h2>From the station</h2><span className="eyebrow">Pill Gate app · record only</span></div>
      {scans === null
        ? <p className="footnote">{error ? `Station scans unavailable (${error}).` : 'Loading station scans…'}</p>
        : scans.length === 0
          ? <p className="footnote">No station scans yet.</p>
          : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {scans.slice(0, 12).map((s) => (
                <li key={s.id} className="stack" style={{ gap: 6, flex: '0 0 auto', minWidth: 0, maxWidth: 240, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }} title={s.headline ?? undefined}>
                  <VerdictChip verdict={s.verdict} />
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.drug}{s.strength ? ` ${s.strength}` : ''}</span>
                  <span className="mono muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>lot {s.lot ?? 'not read'} · {time(s.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
      {scans !== null && error && <p className="footnote">Last refresh failed ({error}); showing the previous list.</p>}
    </section>
  );
}

/** Delivery: one line for the newest station scan of the same lot, or nothing. */
export function StationLine({ lot }: { lot: string }) {
  const { scans } = useStationScans();
  const match = scans?.find((s) => s.lot && s.lot.trim().toUpperCase() === lot.trim().toUpperCase());
  if (!match) return null;
  return (
    <p className="row" style={{ gap: 8, flexWrap: 'wrap', fontSize: 15 }} data-station-line title={match.headline ?? undefined}>
      <span>Station app:</span><VerdictChip verdict={match.verdict} /><span className="mono muted" style={{ fontSize: 13 }}>· {time(match.receivedAt)} · record only</span>
    </p>
  );
}
