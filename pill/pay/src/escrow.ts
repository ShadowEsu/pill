// Verdict-gated escrow on Base Sepolia (TESTNET) with three CDP accounts. Without CDP credentials nothing moves and every
// response says so.
import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, formatUnits, http, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CDP_NETWORK, EXPLORER_TX, USDC_BASE_SEPOLIA, missing } from './env.ts';

export const ACCOUNTS = { clinic: 'pill-clinic', escrow: 'pill-escrow', supplier: 'pill-supplier' } as const;
type Role = keyof typeof ACCOUNTS;
export type Move = 'hold' | 'release' | 'refund';
const LEGS: Record<Move, [Role, Role]> = { hold: ['clinic', 'escrow'], release: ['escrow', 'supplier'], refund: ['escrow', 'clinic'] };

/** Invoice dollars × ESCROW_SCALE = test USDC moved. The CDP faucet gives 1 USDC per claim, so a $1,240 invoice moves 0.124 USDC by default. */
const SCALE = Number(process.env.ESCROW_SCALE || 0.0001);
/** Policy cap per release (COINBASE-TRACK §3): $2,000 invoice value. */
const RELEASE_CAP_USD = 2000;

export const escrowMissing = () => missing('CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET');
export const escrowMode = () => (escrowMissing().length ? 'simulated' : 'cdp') as 'simulated' | 'cdp';

let cdp: CdpClient | null = null;
const client = () => (cdp ??= new CdpClient());
const chain = createPublicClient({ chain: baseSepolia, transport: http() });

async function account(role: Role) {
  return client().evm.getOrCreateAccount({ name: ACCOUNTS[role] });
}

export async function accounts() {
  if (escrowMode() === 'simulated') {
    return {
      mode: 'simulated' as const,
      network: CDP_NETWORK,
      note: `no CDP credentials (missing ${escrowMissing().join(', ')}); these are the account names that would be created, nothing exists on chain`,
      accounts: (Object.keys(ACCOUNTS) as Role[]).map((role) => ({ role, name: ACCOUNTS[role], address: null, usdc: null })),
    };
  }
  const rows = await Promise.all((Object.keys(ACCOUNTS) as Role[]).map(async (role) => {
    const a = await account(role);
    const { balances } = await client().evm.listTokenBalances({ address: a.address, network: CDP_NETWORK });
    const usdc = balances.find((b) => b.token.contractAddress.toLowerCase() === USDC_BASE_SEPOLIA.toLowerCase());
    return { role, name: ACCOUNTS[role], address: a.address, usdc: usdc ? formatUnits(usdc.amount.amount, usdc.amount.decimals) : '0' };
  }));
  return { mode: 'cdp' as const, network: CDP_NETWORK, label: 'TESTNET', accounts: rows };
}

export async function move(kind: Move, deliveryId: string, amountUsd: number) {
  const [fromRole, toRole] = LEGS[kind];
  const usdc = (amountUsd * SCALE).toFixed(6);
  const base = { kind, deliveryId, amount_invoice_usd: amountUsd, amount_usdc: usdc, from: ACCOUNTS[fromRole], to: ACCOUNTS[toRole], network: CDP_NETWORK, label: 'TESTNET' };
  if (kind === 'release' && amountUsd > RELEASE_CAP_USD) {
    return { status: 400, body: { ...base, mode: escrowMode(), error: `release cap is $${RELEASE_CAP_USD} per delivery; this one is $${amountUsd}. Escalate to a person.` } };
  }
  if (escrowMode() === 'simulated') {
    return { status: 200, body: { ...base, mode: 'simulated' as const, tx: '0xsim' + deliveryId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase(), moved: false, note: `no CDP credentials (missing ${escrowMissing().join(', ')}); nothing moved` } };
  }
  const [from, to] = await Promise.all([account(fromRole), account(toRole)]);
  const { transactionHash } = await from.transfer({ to: to.address, amount: parseUnits(usdc, 6), token: 'usdc', network: CDP_NETWORK });
  const receipt = await chain.waitForTransactionReceipt({ hash: transactionHash, timeout: 30_000 }).catch(() => null);
  return {
    status: 200,
    body: {
      ...base, mode: 'cdp' as const, from_address: from.address, to_address: to.address, tx: transactionHash, explorer: EXPLORER_TX + transactionHash,
      moved: receipt?.status === 'success', confirmation: receipt ? receipt.status : 'pending (no receipt within 30 s; check the explorer)',
    },
  };
}

export async function faucet(role: Role = 'clinic', token: 'usdc' | 'eth' = 'usdc') {
  const a = await account(role);
  const { transactionHash } = await client().evm.requestFaucet({ address: a.address, network: CDP_NETWORK, token });
  return { role, name: ACCOUNTS[role], address: a.address, token, tx: transactionHash, explorer: EXPLORER_TX + transactionHash };
}
