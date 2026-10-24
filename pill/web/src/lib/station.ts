// The physical station through the pay service (VITE_PAY_URL → /station/*, pill/pay/src/station.ts). The service owns the
// run state machine (dark → blank → running → plateau | timeout | fault); the app only reads samples and its rules decide.
// No VITE_PAY_URL, no service, or mode 'no_station' → null, and the screens keep their replays. Nothing here invents a sample.
import { PAY_URL } from './api';
import type { Source } from './types';

/** The station's latest contract line (SOFTWARE-PLAN §2): raw counts, its own state, dark pair, latched blank pair. */
export interface StationLine {
  seq: number; state: string; t: number; led: 'blue' | 'white' | 'off'; adc0: number; adc90: number; temp_c: number;
  paddle: number; dark: [number, number]; blank: [number, number] | null; fault: string | null;
}

export interface StationStatus {
  mode: 'serial' | 'sim';
  src: 'real' | 'sim';
  port: string | null;
  /** the current run's state, 'idle' when no run is on */
  state: string;
  noise: number;
  hello: { hello: string; adc_max: number; fw: string } | null;
  last: StationLine | null;
  run: { id: string; state: string; samples: number; t: number; dropT: number | null; message: string | null; ended: boolean } | null;
  timeout_s: number;
}

/** The station when one is connected (a USB serial port, or the service's SERIAL_PORT=sim simulator), else null. */
export async function stationStatus(): Promise<StationStatus | null> {
  if (!PAY_URL) return null;
  try {
    const res = await fetch(`${PAY_URL}/station/status`, { signal: AbortSignal.timeout(2500) });
    const j = (await res.json()) as StationStatus | { mode: 'no_station' };
    return res.ok && j.mode !== 'no_station' ? (j as StationStatus) : null;
  } catch {
    return null;
  }
}

/** Starts dark → blank → start on the station and returns the station's run id (stream it with `stationStreamUrl`). */
export async function startStationRun(): Promise<{ runId: string; src: Source } | null> {
  if (!PAY_URL) return null;
  try {
    const res = await fetch(`${PAY_URL}/station/run/start`, { method: 'POST', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { runId: string; src: 'real' | 'sim' };
    return { runId: j.runId, src: j.src };
  } catch {
    return null;
  }
}

/** SSE of app-shaped samples once a second, then one `end` event (plateau, timeout, fault, stop or a lost station). */
export const stationStreamUrl = (runId: string) => `${PAY_URL ?? ''}/station/stream?run=${encodeURIComponent(runId)}`;
