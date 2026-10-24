// Capital One Nessie SANDBOX: the fiat mirror of the USDC escrow (SOFTWARE-PLAN §4b Rail B).
// One customer 'Pill Clinic' with three checking accounts: clinic (starts 10,000), escrow (0), supplier (0).
// hold = clinic → escrow, release = escrow → supplier, refund = escrow → clinic. Without NESSIE_KEY nothing is called.
//
// Checked against the OpenAPI spec the docs page loads (nessieisreal.com/nessie-openapi-spec.yaml, fetched Sat 2026-10-24):
//   GET/POST /customers, GET/POST /customers/{id}/accounts, GET /accounts/{id}; auth is the `key` query param;
//   CustomerCreate {first_name, last_name, address{street_number, street_name, city, state, zip}};
//   AccountCreate {type:'Checking', nickname, rewards, balance} (balance is an integer); POST answers may be a bare string.
// POST /accounts/{id}/transfers is in the docs quick-start but not in the spec's paths. A keyless probe answered
//   "4 validation errors for TransferCreate: transaction_date, status, amount, description field required", so those four
//   are real; `medium` and `payee_id` come from the classic Nessie docs [unverified], as do the `status` values and the
//   response shape (`objectCreated._id`) [unverified]. When no id comes back, the id is looked up by description.
import type { Move } from './escrow.ts';

const BASE = (process.env.NESSIE_BASE || 'https://api.nessieisreal.com').replace(/\/$/, '');
const CUSTOMER = { first_name: 'Pill', last_name: 'Clinic' };
const ROLES = { clinic: { nickname: 'Pill Clinic', balance: 10000 }, escrow: { nickname: 'Pill Escrow', balance: 0 }, supplier: { nickname: 'Pill Supplier', balance: 0 } } as const;
type Role = keyof typeof ROLES;
const LEGS: Record<Move, [Role, Role]> = { hold: ['clinic', 'escrow'], release: ['escrow', 'supplier'], refund: ['escrow', 'clinic'] };

interface NAccount { _id: string; nickname: string; balance: number; type: string; account_number?: string }

let ids: { customer: string; accounts: Record<Role, string> } | null = null;
let setupError: string | null = null;

export const nessieKey = () => process.env.NESSIE_KEY || '';

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(nessieKey())}`;
  const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* bare string */ }
  if (!res.ok) throw new Error(`nessie ${method} ${path.split('?')[0]} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`.slice(0, 300));
  return data as T;
}

const findCustomer = async () => (await call<{ _id: string; first_name: string; last_name: string }[]>('GET', '/customers'))
  .find((c) => c.first_name === CUSTOMER.first_name && c.last_name === CUSTOMER.last_name) ?? null;

/** Get-or-create the customer and its three accounts. Idempotent; called at start and retried lazily. */
export async function setupNessie() {
  if (!nessieKey()) return null;
  try {
    let customer = await findCustomer();
    if (!customer) {
      await call('POST', '/customers', { ...CUSTOMER, address: { street_number: '1', street_name: 'Market St', city: 'San Francisco', state: 'CA', zip: '94105' } });
      customer = await findCustomer();
      if (!customer) throw new Error('customer was created but is not listed');
    }
    const accountsPath = `/customers/${customer._id}/accounts`;
    let accounts = await call<NAccount[]>('GET', accountsPath);
    const missing = (Object.keys(ROLES) as Role[]).filter((r) => !accounts.some((a) => a.nickname === ROLES[r].nickname));
    for (const r of missing) await call('POST', accountsPath, { type: 'Checking', nickname: ROLES[r].nickname, rewards: 0, balance: ROLES[r].balance });
    if (missing.length) accounts = await call<NAccount[]>('GET', accountsPath);
    const byRole = Object.fromEntries((Object.keys(ROLES) as Role[]).map((r) => [r, accounts.find((a) => a.nickname === ROLES[r].nickname)?._id])) as Record<Role, string | undefined>;
    if (!byRole.clinic || !byRole.escrow || !byRole.supplier) throw new Error('an account is missing after create');
    ids = { customer: customer._id, accounts: byRole as Record<Role, string> };
    setupError = null;
    return ids;
  } catch (e) {
    setupError = (e as Error).message;
    console.warn(`[nessie] setup failed: ${setupError}`);
    return null;
  }
}

export async function nessieAccounts() {
  if (!nessieKey()) return { mode: 'unavailable' as const, reason: 'no NESSIE_KEY on the service; nothing is mirrored' };
  const r = ids ?? (await setupNessie());
  if (!r) return { mode: 'unavailable' as const, reason: setupError ?? 'setup failed' };
  try {
    const rows = await Promise.all((Object.keys(ROLES) as Role[]).map(async (role) => {
      const a = await call<NAccount>('GET', `/accounts/${r.accounts[role]}`);
      return { role, nickname: a.nickname, id: a._id, balance: a.balance };
    }));
    return { mode: 'sandbox' as const, label: 'SANDBOX', customer_id: r.customer, accounts: rows };
  } catch (e) {
    return { mode: 'unavailable' as const, reason: (e as Error).message };
  }
}

/** Mirror one escrow move. Never throws; the USDC rail's answer does not depend on this. */
export async function nessieTransfer(kind: Move, deliveryId: string, amountUsd: number) {
  if (!nessieKey()) return { mode: 'unavailable' as const, reason: 'no NESSIE_KEY' };
  const r = ids ?? (await setupNessie());
  if (!r) return { mode: 'unavailable' as const, reason: setupError ?? 'setup failed' };
  const [from, to] = LEGS[kind];
  const description = `pill ${kind} ${deliveryId} ${Date.now().toString(36)}`;
  try {
    const res = await call<{ objectCreated?: { _id?: string }; _id?: string; message?: string } | string>('POST', `/accounts/${r.accounts[from]}/transfers`, {
      medium: 'balance', payee_id: r.accounts[to], amount: amountUsd, transaction_date: new Date().toISOString().slice(0, 10), status: 'pending', description,
    });
    let transfer_id = typeof res === 'object' ? res.objectCreated?._id ?? res._id ?? null : null;
    if (!transfer_id) {
      const list = await call<{ _id: string; description?: string }[]>('GET', `/accounts/${r.accounts[from]}/transfers`).catch(() => []);
      transfer_id = list.find((t) => t.description === description)?._id ?? null;
    }
    return { mode: 'sandbox' as const, label: 'SANDBOX', transfer_id, from: ROLES[from].nickname, to: ROLES[to].nickname, amount: amountUsd, description };
  } catch (e) {
    return { mode: 'unavailable' as const, reason: (e as Error).message };
  }
}

export const nessieMode = () => (!nessieKey() ? 'unavailable' : ids ? 'sandbox' : setupError ? `unavailable (${setupError})` : 'starting');
