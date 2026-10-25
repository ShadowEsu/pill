// The physical station as the pay service reports it (/station/status): serial · simulated · no station.
// One chip everywhere it shows (Place, Settings, the Dashboard station card) and one poll hook behind it.
import { useEffect, useState } from 'react';
import { stationStatus, type StationStatus } from '../lib/station';

/** Polls /station/status every `every` ms while mounted. undefined = first answer pending; null = no station
 *  (no VITE_PAY_URL, the service is down, or it reports mode 'no_station'). */
export function useStationStatus(every = 5000): StationStatus | null | undefined {
  const [status, setStatus] = useState<StationStatus | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const poll = () => void stationStatus().then((s) => { if (alive) setStatus(s); });
    poll();
    const timer = window.setInterval(poll, every);
    return () => { alive = false; clearInterval(timer); };
  }, [every]);
  return status;
}

export default function StationChip({ status }: { status: StationStatus | null | undefined }) {
  if (status === undefined) return <span className="chip live" data-station="checking"><span className="dot" />checking the station</span>;
  if (!status) return <span className="chip" data-station="none"><span className="dot" />no station</span>;
  return (
    <span className="chip ok pop-in" data-station={status.mode} title={status.port ?? undefined}>
      <span className="dot" />Station online · {status.mode === 'sim' ? 'simulated' : 'serial'}
    </span>
  );
}
