// The station bridge: the Uno's JSON lines over USB serial (SOFTWARE-PLAN §2) in, app-shaped samples over SSE out.
// The firmware measures and streams; this file owns the run state machine (idle → dark → blank → running → plateau |
// timeout, any → fault) and decides when a run ends. It never decides a verdict: the app's rules do, from the samples.
//   SERIAL_PORT unset (or off) → mode 'no_station', the port is never touched: the Pill Gate Python app and flashing tools own it
//   SERIAL_PORT=auto → scan /dev/cu.usbmodem* and /dev/cu.usbserial* every 3 s (a board plugged in later is picked up)
//   SERIAL_PORT=/dev/… → that port only     SERIAL_PORT=sim → the built-in simulator below (status says mode:'sim')
// No port and no sim → mode:'no_station' and nothing is ever invented: the app keeps its replays.
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { ReadlineParser, SerialPort } from 'serialport';

// ---- the contract ----
export const COMMANDS = ['D', 'B', 'S', 'X', '1', '2', 'R'] as const;
export type Command = (typeof COMMANDS)[number];
export type Fault = 'LID_OPEN' | 'ADC_SAT' | 'TEMP_RANGE' | 'THERM_OPEN' | 'LED_DEAD' | 'BROWNOUT';
export interface Line {
  v: 1; seq: number; src: string; state: string; t: number; led: 'blue' | 'white' | 'off';
  adc0: number; adc90: number; temp_c: number; paddle: number;
  dark: [number, number]; blank: [number, number] | null; fault: Fault | string | null;
}
export interface Hello { v: 1; hello: string; adc_max: number; fw: string }

/** The app's `Sample` (pill/web/src/lib/types.ts). */
export interface AppSample {
  t: number; adc0: number; adc90: number; temp: number; dark: number; blank: number;
  led: boolean; paddle: boolean; lid: boolean; fault: string | null;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isPair = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && isNum(x[0]) && isNum(x[1]);

/** One serial line → a contract line, a hello line, or null (counted as noise; never interpolated). */
export function parseLine(raw: string): { line: Line } | { hello: Hello } | null {
  let j: Record<string, unknown>;
  try { j = JSON.parse(raw.trim()) as Record<string, unknown>; } catch { return null; }
  if (!j || typeof j !== 'object' || j.v !== 1) return null;
  if (typeof j.hello === 'string') return isNum(j.adc_max) ? { hello: j as unknown as Hello } : null;
  const ok = isNum(j.seq) && typeof j.state === 'string' && isNum(j.t) && typeof j.led === 'string' && isNum(j.adc0) && isNum(j.adc90)
    && isNum(j.temp_c) && isNum(j.paddle) && isPair(j.dark) && (j.blank === null || isPair(j.blank))
    && (j.fault === null || typeof j.fault === 'string');
  return ok ? { line: j as unknown as Line } : null;
}

const APP_FAULT: Record<string, string> = {
  LID_OPEN: 'lid_open', LED_DEAD: 'led_fail', ADC_SAT: 'led_fail', TEMP_RANGE: 'temp_out', THERM_OPEN: 'temp_out', BROWNOUT: 'brownout',
};
const LED_MIN_SPAN = 75; // blank0 − dark0 on the 10-bit scale (300 on the 12-bit contract)

/** Contract line → app sample. Counts are dark-subtracted so the app's absorbance(blank, adc0) = log10(blank/adc0) is exactly
 *  SOFTWARE-PLAN §2's A(t) = log10((blank0 − dark0)/(adc0 − dark0)). The 90° channel rises with the riboflavin glow, while
 *  the app reads glow as log10(blank/adc90); so adc90 is handed over as blank′ · (blank90 − dark90)/(adc90 − dark90), which
 *  makes the app's glow = log10((adc90 − dark90)/(blank90 − dark90)): 0 on clear water, rising as the water glows.
 *  Before a blank is latched both are passed through raw and `blank` is 0 (the app then reads absorbance 0). */
export function toSample(l: Line, faultOverride?: string): AppSample {
  const [d0, d90] = l.dark;
  const blank = l.blank ? Math.max(1, l.blank[0] - d0) : 0;
  const adc0 = l.blank ? Math.max(1, l.adc0 - d0) : l.adc0;
  const adc90 = l.blank ? Math.round((blank * Math.max(1, l.blank[1] - d90)) / Math.max(1, l.adc90 - d90)) : l.adc90;
  const fault = faultOverride ?? (l.fault ? APP_FAULT[l.fault] ?? l.fault.toLowerCase() : l.blank ? null : 'no_blank');
  return {
    t: +l.t.toFixed(1), adc0, adc90, temp: l.temp_c, dark: d0, blank,
    led: !!l.blank && l.blank[0] - d0 >= LED_MIN_SPAN, paddle: l.paddle > 0, lid: l.fault !== 'LID_OPEN', fault,
  };
}

// ---- tuning (env) ----
const num = (k: string, d: number) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; };
const TIMEOUT_S = num('STATION_TIMEOUT_S', 180);    // demo; SOFTWARE-PLAN §3 says 1.5 × slowest B2 plateau, 300 s default
const PLATEAU_WINDOW_S = 20;
const PLATEAU_EPS = num('STATION_EPS', 0.001);       // |dA/dt| per second over the 20-s window
const PLATEAU_MIN_S = num('STATION_MIN_S', 60);      // a flat line before 60 s is "nothing has started", not a plateau
const DARK_LINES = 3, BLANK_LINES = 10, BLANK_CV = 0.02, BLANK_TRIES = 3, DROP = 0.06;

// ---- sources: a serial port or the simulator; both deliver raw text lines ----
interface Source { kind: 'serial' | 'sim'; path: string; write(c: Command): void; close(): void }

/** Plays the firmware: same commands, same line format, 1 line/s (SIM_SPEED=n plays n lines per wall second).
 *  The curve is riboflavin-like: inline absorbance rises to 0.43 (τ 30 s) and the 90° glow to 0.30 (τ 33 s) after S. */
class SimStation implements Source {
  kind = 'sim' as const; path = 'sim';
  private seq = 0; private n = 0; private t0 = -1; private paddle = false; private white = false;
  private state = 'idle'; private blank: [number, number] | null = null; private last: [number, number] = [0, 0];
  private timer: NodeJS.Timeout;
  private seed = 7;
  constructor(private onText: (s: string) => void) {
    setTimeout(() => onText(JSON.stringify({ v: 1, hello: 'pill_uno', adc_max: 1023, fw: '0.1-sim' })), 50);
    this.timer = setInterval(() => this.tick(), 1000 / num('SIM_SPEED', 1));
  }
  private rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296 - 0.5; }
  private tick() {
    this.n++;
    const t = this.t0 >= 0 ? this.n - this.t0 : 0;
    const dark: [number, number] = [8 + Math.round(this.rnd() * 2), 6 + Math.round(this.rnd() * 2)];
    const a = this.t0 >= 0 ? 0.43 * (1 - Math.exp(-t / 30)) : 0;
    const g = this.t0 >= 0 ? 0.3 * (1 - Math.exp(-t / 33)) : 0;
    const adc0 = Math.round(dark[0] + (760 - 8) * 10 ** -a + this.rnd() * 3);
    const adc90 = Math.round(dark[1] + (140 - 6) * 10 ** g + this.rnd() * 2);
    this.last = [adc0, adc90];
    this.onText(JSON.stringify({
      v: 1, seq: this.seq++, src: 'sim', state: this.state, t: t, led: this.white ? 'white' : 'blue', adc0, adc90,
      temp_c: +(24.6 + this.rnd() * 0.2).toFixed(1), paddle: this.paddle ? 12 : 0, dark, blank: this.blank, fault: null,
    }));
  }
  write(c: Command) {
    if (c === 'D') this.state = 'dark';
    if (c === 'B') { this.blank = [...this.last]; this.state = 'blank'; }
    if (c === 'S') { this.paddle = true; this.t0 = this.n; this.state = 'running'; }
    if (c === 'X') { this.paddle = false; this.t0 = -1; this.state = 'idle'; }
    if (c === '1') this.white = false;
    if (c === '2') this.white = true;
    if (c === 'R') { this.paddle = false; this.t0 = -1; this.blank = null; this.seq = 0; this.white = false; this.state = 'idle'; }
  }
  close() { clearInterval(this.timer); }
}

function openSerial(path: string, onText: (s: string) => void, onClose: () => void): Promise<Source> {
  const { promise, resolve, reject } = Promise.withResolvers<Source>();
  const port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
  port.open((err) => {
    if (err) { reject(err); return; }
    port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', (s: string) => onText(s));
    port.on('close', onClose);
    port.on('error', () => { if (port.isOpen) port.close(); });
    resolve({ kind: 'serial', path, write: (c) => { port.write(c); }, close: () => { if (port.isOpen) port.close(); } });
  });
  return promise;
}

// ---- the run ----
export type RunState = 'idle' | 'dark' | 'blank' | 'running' | 'plateau' | 'timeout' | 'fault' | 'stopped' | 'lost';
interface StationRun {
  id: string; state: RunState; startedAt: number; samples: AppSample[]; message: string | null;
  dropT: number | null; ended: boolean; subs: Set<Response>;
}

class Station {
  src: Source | null = null;
  last: Line | null = null;
  lastAt = 0;
  hello: Hello | null = null;
  noise = 0;
  run: StationRun | null = null;
  private runs = new Map<string, StationRun>();
  private listeners = new Set<(l: Line) => void>();

  start() {
    const want = process.env.SERIAL_PORT?.trim();
    // opt-in only: an unasked-for open would steal the board from the Pill Gate app or a flashing job
    if (!want || want === 'off') return;
    if (want === 'sim') { this.src = new SimStation((s) => this.onText(s)); return; }
    let opening = false;
    const tryOpen = async () => {
      if (this.src || opening) return;
      let path: string | null = want;
      if (want === 'auto') {
        try { path = readdirSync('/dev').filter((f) => /^cu\.(usbmodem|usbserial)/.test(f)).sort().map((f) => `/dev/${f}`)[0] ?? null; } catch { path = null; }
      }
      if (!path) return;
      opening = true;
      try {
        this.src = await openSerial(path, (s) => this.onText(s), () => this.onLost());
        console.log(`  station       serial ${path} @ 115200`);
      } catch { /* not there yet (or busy): try again on the next scan */ }
      opening = false;
    };
    void tryOpen();
    setInterval(() => void tryOpen(), 3000).unref();
  }

  get mode(): 'serial' | 'sim' | 'no_station' { return this.src ? this.src.kind : 'no_station'; }

  private onLost() {
    this.src = null; this.hello = null;
    if (this.run && !this.run.ended) this.end(this.run, 'lost', 'the station disconnected');
  }

  private onText(text: string) {
    const p = parseLine(text);
    if (!p) { if (text.trim()) this.noise++; return; }
    if ('hello' in p) {
      this.hello = p.hello;
      // a hello mid-run means the board reset: its blank and t are gone
      if (this.run && !this.run.ended && this.run.state !== 'dark') this.faultEnd(this.run, null, 'no_blank', 'the station reset during the run');
      return;
    }
    this.last = p.line; this.lastAt = Date.now();
    this.listeners.forEach((f) => f(p.line));
  }

  send(c: Command) { this.src?.write(c); }

  status() {
    const r = this.run;
    return {
      mode: this.mode, src: this.src ? (this.src.kind === 'sim' ? 'sim' : 'real') : null, port: this.src?.path ?? null,
      state: r && !r.ended ? r.state : 'idle', last: this.last, noise: this.noise, hello: this.hello,
      run: r ? { id: r.id, state: r.state, samples: r.samples.length, t: r.samples.at(-1)?.t ?? 0, dropT: r.dropT, message: r.message, ended: r.ended } : null,
      timeout_s: TIMEOUT_S,
    };
  }

  /** Lines arriving after now, until `n` lines or `ms` pass; a run that ended meanwhile returns null. */
  private collect(r: StationRun, n: number, ms: number): Promise<Line[] | null> {
    const { promise, resolve } = Promise.withResolvers<Line[] | null>();
    const got: Line[] = [];
    const done = () => { clearTimeout(timer); this.listeners.delete(on); resolve(r.ended ? null : got); };
    const on = (l: Line) => { got.push(l); if (got.length >= n || l.fault || r.ended) done(); };
    const timer = setTimeout(done, ms);
    this.listeners.add(on);
    return promise;
  }

  private setState(r: StationRun, s: RunState, message: string | null = r.message) {
    r.state = s; r.message = message;
    this.broadcast(r, 'state', { state: s, message });
  }

  private broadcast(r: StationRun, event: string | null, data: unknown) {
    const msg = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
    r.subs.forEach((res) => res.write(msg));
  }

  private push(r: StationRun, s: AppSample) { r.samples.push(s); this.broadcast(r, null, s); }

  private end(r: StationRun, s: RunState, message: string | null = null) {
    if (r.ended) return;
    r.ended = true;
    this.send('X');
    this.setState(r, s, message);
    this.broadcast(r, 'end', { reason: s, message, samples: r.samples.length });
    r.subs.forEach((res) => res.end());
    r.subs.clear();
  }

  /** A fault keeps the run and its trace; one sample carries the fault so the app's rules land on U2 (or U3 if too short). */
  private faultEnd(r: StationRun, l: Line | null, appFault: string | null, message: string) {
    if (r.ended) return;
    const base = l ?? this.last;
    if (base) this.push(r, toSample(base, appFault ?? undefined));
    this.end(r, 'fault', message);
  }

  async startRun(): Promise<StationRun> {
    if (this.run && !this.run.ended) this.end(this.run, 'stopped', 'replaced by a new run');
    const r: StationRun = { id: randomUUID().slice(0, 8), state: 'idle', startedAt: Date.now(), samples: [], message: null, dropT: null, ended: false, subs: new Set() };
    this.runs.set(r.id, r);
    for (const k of [...this.runs.keys()].slice(0, -20)) this.runs.delete(k);
    this.run = r;
    void this.procedure(r).catch((e) => this.end(r, 'lost', (e as Error).message));
    return r;
  }

  private async procedure(r: StationRun) {
    this.send('R'); this.send('1');
    // dark: LEDs off, 3 lines; LID_OPEN (tilt or dark0 > 100) or any other hardware fault stops here
    this.setState(r, 'dark', null);
    this.send('D');
    const dark = await this.collect(r, DARK_LINES, DARK_LINES * 2500);
    if (!dark) return;
    if (!dark.length) { this.end(r, 'lost', 'the station sent nothing for 7 s'); return; }
    const df = dark.find((l) => l.fault);
    if (df) { this.faultEnd(r, df, null, `fault during the dark reading: ${df.fault}`); return; }

    // blank: plain water, 10 lines, CV(adc0) < 2 % else retry (3 tries)
    let ok = false;
    for (let i = 0; i < BLANK_TRIES && !ok; i++) {
      this.setState(r, 'blank', i ? 'unstable blank, retry' : null);
      const bl = await this.collect(r, BLANK_LINES, BLANK_LINES * 2500);
      if (!bl) return;
      const bf = bl.find((l) => l.fault);
      if (bf) { this.faultEnd(r, bf, null, `fault during the blank: ${bf.fault}`); return; }
      const xs = bl.map((l) => l.adc0);
      const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
      ok = xs.length >= BLANK_LINES / 2 && mean > 0 && sd / mean < BLANK_CV;
    }
    if (!ok) { this.faultEnd(r, null, 'no_blank', 'unstable blank after 3 tries'); return; }
    this.send('B');
    const latched = await this.collect(r, 1, 2500);
    if (!latched) return;
    const lb = latched[0];
    if (!lb || !lb.blank) { this.faultEnd(r, lb ?? null, 'no_blank', 'the station did not latch the blank'); return; }
    if (lb.fault) { this.faultEnd(r, lb, null, `fault after the blank: ${lb.fault}`); return; }

    // running: paddle on, t = 0; every running line becomes a sample until plateau, timeout or fault
    this.send('S');
    this.setState(r, 'running', null);
    const on = (l: Line) => {
      if (r.ended) { this.listeners.delete(on); return; }
      if (l.state !== 'running') return; // a line already in flight before S
      if (l.fault || !l.blank) { this.listeners.delete(on); this.faultEnd(r, l, null, l.fault ? `fault while running: ${l.fault}` : 'the blank was lost'); return; }
      const s = toSample(l);
      this.push(r, s);
      if (r.dropT === null && s.adc0 <= s.blank * (1 - DROP)) r.dropT = s.t;
      if (r.dropT === null && s.t >= 30 && !r.message) this.setState(r, 'running', 'no drop in 30 s: drop the tablet');
      const why = this.finished(r);
      if (why) { this.listeners.delete(on); this.end(r, why); }
    };
    this.listeners.add(on);
  }

  /** Plateau: least-squares slope of A over the last 20 s below ε once t ≥ 60 s; timeout at STATION_TIMEOUT_S. */
  private finished(r: StationRun): RunState | null {
    const last = r.samples.at(-1);
    if (!last) return null;
    if (last.t >= TIMEOUT_S) return 'timeout';
    if (last.t < PLATEAU_MIN_S) return null;
    const w = r.samples.filter((s) => s.t >= last.t - PLATEAU_WINDOW_S).map((s) => ({ t: s.t, a: Math.log10(s.blank / s.adc0) }));
    if (w.length < PLATEAU_WINDOW_S * 0.75) return null;
    const mt = w.reduce((a, p) => a + p.t, 0) / w.length;
    const ma = w.reduce((a, p) => a + p.a, 0) / w.length;
    const slope = w.reduce((a, p) => a + (p.t - mt) * (p.a - ma), 0) / (w.reduce((a, p) => a + (p.t - mt) ** 2, 0) || 1);
    return Math.abs(slope) < PLATEAU_EPS ? 'plateau' : null;
  }

  stop() { if (this.run && !this.run.ended) this.end(this.run, 'stopped', 'stopped from the app'); }

  /** SSE: everything collected so far, then live samples, `state` events, and one `end`. */
  subscribe(id: string, res: Response): boolean {
    const r = this.runs.get(id);
    if (!r) return false;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\nevent: state\ndata: ${JSON.stringify({ state: r.state, message: r.message })}\n\n`);
    r.samples.forEach((s) => res.write(`data: ${JSON.stringify(s)}\n\n`));
    if (r.ended) { res.write(`event: end\ndata: ${JSON.stringify({ reason: r.state, message: r.message, samples: r.samples.length })}\n\n`); res.end(); return true; }
    r.subs.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    res.on('close', () => { clearInterval(ping); r.subs.delete(res); });
    return true;
  }
}

export const station = new Station();

export function stationRouter(): Router {
  const r = Router();
  r.get('/station/status', (_req, res) => { res.json(station.status()); });
  r.post('/station/cmd', (req, res) => {
    const cmd = (req.body as { cmd?: unknown } | undefined)?.cmd;
    if (typeof cmd !== 'string' || !(COMMANDS as readonly string[]).includes(cmd)) { res.status(400).json({ error: `cmd must be one of ${COMMANDS.join(' ')}` }); return; }
    if (station.mode === 'no_station') { res.status(409).json({ mode: 'no_station', error: 'no station connected' }); return; }
    station.send(cmd as Command);
    res.json({ ok: true, sent: cmd, mode: station.mode });
  });
  r.post('/station/run/start', async (_req, res) => {
    if (station.mode === 'no_station') { res.status(409).json({ mode: 'no_station', error: 'no station connected' }); return; }
    if (Date.now() - station.lastAt > 3000) { res.status(503).json({ mode: station.mode, error: 'the station is connected but has sent no line in 3 s' }); return; }
    const run = await station.startRun();
    res.json({ runId: run.id, mode: station.mode, src: station.mode === 'sim' ? 'sim' : 'real', timeout_s: TIMEOUT_S });
  });
  r.post('/station/run/stop', (_req, res) => { station.stop(); res.json(station.status()); });
  r.get('/station/stream', (req, res) => {
    const id = typeof req.query.run === 'string' ? req.query.run : '';
    if (!station.subscribe(id, res)) res.status(404).json({ error: 'unknown run' });
  });
  return r;
}
