// Tiger Data (TimescaleDB): every station sample as one row in a hypertable. Only with TIGER_URL (a Postgres connection
// string); without it every route answers {mode:'unavailable'} and nothing pretends to be stored.
//   initTiger()        → on start: extension, table, hypertable (idempotent)
//   insertSamples()    → one batched INSERT per run (unnest over arrays, one round trip)
//   tigerStatus()      → {mode:'live', rows, last} | {mode:'unavailable', reason}
//   plateauCurve()     → the run's curve in 10-second time_bucket()s
import pg from 'pg';

export interface TigerSample { t: number; abs: number; glow: number; temp: number }
export interface SamplesInput { run_id: string; station: string; started_at: number; samples: TigerSample[] }
type Unavailable = { mode: 'unavailable'; reason: string };

const MAX_SAMPLES = 2000;
let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;
let lastError: string | null = null;

export const tigerMode = (): 'live' | 'unavailable' => (pool && !lastError ? 'live' : 'unavailable');

/** Creates the schema once. Safe to call on every start. */
export async function initTiger(): Promise<{ mode: 'live' } | Unavailable> {
  const url = process.env.TIGER_URL;
  if (!url) return { mode: 'unavailable', reason: 'no TIGER_URL' };
  pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 8_000, ssl: /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
  pool.on('error', (e) => { lastError = e.message; });
  ready = (async () => {
    await pool!.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
    await pool!.query('CREATE TABLE IF NOT EXISTS samples(time timestamptz NOT NULL, run_id text NOT NULL, station text NOT NULL, abs double precision, glow double precision, temp double precision)');
    await pool!.query("SELECT create_hypertable('samples', 'time', if_not_exists => true)");
    await pool!.query('CREATE INDEX IF NOT EXISTS samples_run_time ON samples (run_id, time DESC)');
  })();
  try { await ready; lastError = null; return { mode: 'live' }; }
  catch (e) { lastError = (e as Error).message; return { mode: 'unavailable', reason: lastError }; }
}

async function live(): Promise<pg.Pool | Unavailable> {
  if (!pool || !ready) return { mode: 'unavailable', reason: 'no TIGER_URL' };
  try { await ready; } catch (e) { return { mode: 'unavailable', reason: (e as Error).message }; }
  return pool;
}

const fin = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export function parseSamples(body: unknown): SamplesInput | { error: string } {
  const b = body as Partial<Record<keyof SamplesInput, unknown>> | undefined;
  if (typeof b?.run_id !== 'string' || !b.run_id.trim() || b.run_id.length > 64) return { error: 'send {"run_id": string, "station": string, "samples": [{t, abs, glow, temp}]}' };
  if (!Array.isArray(b.samples) || !b.samples.length) return { error: 'samples must be a non-empty array' };
  if (b.samples.length > MAX_SAMPLES) return { error: `at most ${MAX_SAMPLES} samples per call` };
  const samples = b.samples as Record<string, unknown>[];
  if (!samples.every((s) => fin(s?.t) && fin(s?.abs) && fin(s?.glow) && fin(s?.temp))) return { error: 'every sample needs numeric t, abs, glow, temp' };
  const last = Math.max(...samples.map((s) => s.t as number));
  return {
    run_id: b.run_id.trim(),
    station: typeof b.station === 'string' && b.station.trim() ? b.station.trim().slice(0, 64) : 'STATION 01',
    // t is seconds since the run started; without started_at the last sample is "now"
    started_at: fin(b.started_at) ? (b.started_at as number) : Date.now() - last * 1000,
    samples: samples as unknown as TigerSample[],
  };
}

export async function insertSamples(i: SamplesInput): Promise<{ mode: 'live'; inserted: number } | Unavailable> {
  const p = await live();
  if ('mode' in p) return p;
  const time = i.samples.map((s) => new Date(i.started_at + s.t * 1000).toISOString());
  try {
    const r = await p.query(
      'INSERT INTO samples (time, run_id, station, abs, glow, temp) SELECT t, $2, $3, a, g, c FROM unnest($1::timestamptz[], $4::float8[], $5::float8[], $6::float8[]) AS u(t, a, g, c)',
      [time, i.run_id, i.station, i.samples.map((s) => s.abs), i.samples.map((s) => s.glow), i.samples.map((s) => s.temp)],
    );
    return { mode: 'live', inserted: r.rowCount ?? 0 };
  } catch (e) { return { mode: 'unavailable', reason: (e as Error).message }; }
}

export async function tigerStatus(): Promise<{ mode: 'live'; rows: number; runs: number; last: string | null } | Unavailable> {
  const p = await live();
  if ('mode' in p) return p;
  try {
    const r = await p.query<{ rows: number; runs: number; last: Date | null }>('SELECT count(*)::int AS rows, count(DISTINCT run_id)::int AS runs, max(time) AS last FROM samples');
    const row = r.rows[0];
    return { mode: 'live', rows: row.rows, runs: row.runs, last: row.last ? row.last.toISOString() : null };
  } catch (e) { return { mode: 'unavailable', reason: (e as Error).message }; }
}

export async function plateauCurve(runId: string): Promise<{ mode: 'live'; run_id: string; buckets: { bucket: string; abs: number; glow: number; temp: number; n: number }[] } | Unavailable> {
  const p = await live();
  if ('mode' in p) return p;
  try {
    const r = await p.query<{ bucket: Date; abs: number; glow: number; temp: number; n: number }>(
      "SELECT time_bucket('10 seconds', time) AS bucket, avg(abs) AS abs, avg(glow) AS glow, avg(temp) AS temp, count(*)::int AS n FROM samples WHERE run_id = $1 GROUP BY bucket ORDER BY bucket",
      [runId],
    );
    return { mode: 'live', run_id: runId, buckets: r.rows.map((x) => ({ bucket: x.bucket.toISOString(), abs: +x.abs.toFixed(4), glow: +x.glow.toFixed(4), temp: +x.temp.toFixed(2), n: x.n })) };
  } catch (e) { return { mode: 'unavailable', reason: (e as Error).message }; }
}
