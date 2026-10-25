// Station scans handed over by the Pill Gate station app (pillgate/app, GET /api/scans/{id}). A record only: nothing here
// feeds the policy agent or moves money. Kept in memory and in data/station-scans.json so a restart keeps them.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Verdict } from './rules.ts';

/** Pill Gate's `overall` (evidence.overall_result → analysis.py) → the clinic's verdict words. `PASSED` is accepted as an alias. */
const VERDICT: Record<string, Verdict> = { PASSED_SCREEN: 'PASS', PASSED: 'PASS', NEEDS_LAB: 'NEEDS LAB', UNABLE_TO_VERIFY: 'UNABLE TO VERIFY' };
/** evidence.recall_status values. */
const RECALL = ['LOT_RECALLED', 'PRODUCT_HAS_RECALLS_OTHER_LOTS', 'NO_RECALL_FOUND', 'NOT_CHECKED'];

export interface StationScan {
  id: string;
  source: 'pill-gate';
  scanId: string;
  drug: string;
  strength: string | null;
  lot: string | null;
  maker: string | null;
  expiry: string | null;
  verdict: Verdict;
  recallStatus: string;
  headline: string | null;
  receivedAt: number;
}

const FILE = fileURLToPath(new URL('../data/station-scans.json', import.meta.url));
const MAX = 200;

let scans: StationScan[] = (() => {
  try { return existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as StationScan[]) : []; }
  catch (e) { console.warn(`[gate] ${FILE} unreadable (${(e as Error).message}); starting empty`); return []; }
})();

function persist() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE + '.tmp', JSON.stringify(scans, null, 2));
  renameSync(FILE + '.tmp', FILE);
}

/** Optional short string: absent/null → null; anything else must be a string. */
function optStr(v: unknown, name: string, errors: string[], max = 120): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') { errors.push(`${name} must be a string or null`); return null; }
  return v.trim().slice(0, max) || null;
}

/** Validates the fields this route uses from a Pill Gate scan; everything else in the body is ignored. */
export function parseStationScan(body: unknown, scanIdParam: unknown): Omit<StationScan, 'id' | 'source' | 'receivedAt'> | { errors: string[] } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['body must be the Pill Gate scan JSON object'] };
  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  const verdict = typeof b.overall === 'string' ? VERDICT[b.overall] : undefined;
  if (!verdict) errors.push(`overall must be one of ${Object.keys(VERDICT).join(', ')} (got ${JSON.stringify(b.overall ?? null)}); an unfinished scan has no overall`);
  const label = b.label;
  if (!label || typeof label !== 'object' || Array.isArray(label)) errors.push('label must be an object');
  const l = (label ?? {}) as Record<string, unknown>;
  const drug = optStr(l.drug_name, 'label.drug_name', errors);
  if (!drug && !errors.some((e) => e.startsWith('label'))) errors.push('label.drug_name is required');
  const strength = optStr(l.strength, 'label.strength', errors, 40);
  const lot = optStr(l.lot, 'label.lot', errors, 40);
  const maker = optStr(l.manufacturer, 'label.manufacturer', errors);
  const expiry = optStr(l.expiry, 'label.expiry', errors, 20);
  const recallStatus = b.recall_status === undefined || b.recall_status === null ? 'NOT_CHECKED' : b.recall_status;
  if (typeof recallStatus !== 'string' || !RECALL.includes(recallStatus)) errors.push(`recall_status must be one of ${RECALL.join(', ')}`);
  const report = b.report;
  if (report !== undefined && report !== null && (typeof report !== 'object' || Array.isArray(report))) errors.push('report must be an object or null');
  const headline = optStr(report && typeof report === 'object' && 'headline' in report ? report.headline : null, 'report.headline', errors, 200);
  // The scan body from GET /api/scans/{id} carries no id of its own: ?scanId= (or body.id) names it; run_id is the fallback.
  const scanId = [scanIdParam, b.id, b.scan_id, b.run_id].find((v) => typeof v === 'string' && /^[\w.-]{1,80}$/.test(v)) as string | undefined;
  if (!scanId) errors.push('a scan id is required: ?scanId=scan_…, or id / run_id in the body ([A-Za-z0-9_.-], ≤ 80 chars)');
  if (errors.length) return { errors };
  return { scanId: scanId!, drug: drug!, strength, lot, maker, expiry, verdict: verdict!, recallStatus: recallStatus as string, headline };
}

/** Upsert by scanId (re-posting the same scan replaces it), newest first. */
export function recordStationScan(s: Omit<StationScan, 'id' | 'source' | 'receivedAt'>): StationScan {
  const prev = scans.find((x) => x.scanId === s.scanId);
  const entry: StationScan = { id: prev?.id ?? `st-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, source: 'pill-gate', ...s, receivedAt: Date.now() };
  scans = [entry, ...scans.filter((x) => x.scanId !== s.scanId)].slice(0, MAX);
  persist();
  return entry;
}

export const stationScans = () => scans;
