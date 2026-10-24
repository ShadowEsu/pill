// x402 buyer: ask another station for a verdict, read the price from the 402, pay only under the spend cap.
//   npm run buy -- --url http://localhost:8402/verify --curve B2-07 [--cap 1.00] [--simulated]
// Payer, strongest first: CDP wallet `pill-clinic` (CdpX402Client) → BUYER_PRIVATE_KEY (local signer) → none (exit 2).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CdpX402Client } from '@coinbase/cdp-sdk/x402';
import { x402Client } from '@x402/core/client';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import type { PaymentRequirements } from '@x402/core/types';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { EXPLORER_TX, NETWORK, USDC_BASE_SEPOLIA, missing } from './env.ts';
import { ACCOUNTS } from './escrow.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:8402/verify' },
    curve: { type: 'string', default: 'B2-07' },
    cap: { type: 'string', default: '1.00' },
    simulated: { type: 'boolean', default: false },
  },
});
const url = args.url!;
const capUsd = Number(args.cap);
const init = { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ curve: args.curve }) };
const say = (label: string, value: unknown) => console.log(`${label.padEnd(12)} ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);

/** Rolling 24 h spend ledger kept next to the package (git-ignored). The cap covers all buys, not just this one. */
const LEDGER = fileURLToPath(new URL('../.spend-ledger.json', import.meta.url));
const ledger: { at: number; usd: number; url: string; tx: string }[] = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : [];
const spent24h = ledger.filter((e) => e.at > Date.now() - 86_400_000).reduce((a, e) => a + e.usd, 0);

// 1. Ask without paying.
const first = await fetch(url, init);
say('request', `POST ${url}  ${init.body}`);
say('status', `${first.status} ${first.statusText}  mode=${first.headers.get('x-pill-mode') ?? 'unknown'}`);
if (first.status !== 402) {
  say('body', await first.json().catch(() => '(not JSON)'));
  process.exit(first.ok ? 0 : 1);
}
const header = first.headers.get('payment-required');
if (!header) { console.error('402 without a PAYMENT-REQUIRED header; not an x402 server.'); process.exit(1); }
const required = decodePaymentRequiredHeader(header);
say('402 accepts', required.accepts);

// 2. Price check before any signing.
const pick: PaymentRequirements | undefined = required.accepts.find((a) => a.network === NETWORK && a.asset.toLowerCase() === USDC_BASE_SEPOLIA.toLowerCase());
if (!pick) { console.error(`No Base Sepolia USDC option in the 402 (want ${NETWORK} ${USDC_BASE_SEPOLIA}). Not paying.`); process.exit(3); }
const priceUsd = Number(formatUnits(BigInt(pick.amount), 6));
say('price', `${priceUsd} USDC (TESTNET) to ${pick.payTo}`);
say('spend cap', `${capUsd.toFixed(2)} USDC per 24 h · spent ${spent24h.toFixed(2)} · after this ${(spent24h + priceUsd).toFixed(2)}`);
if (spent24h + priceUsd > capUsd) { console.error(`Refusing: ${priceUsd} USDC would take the 24 h spend to ${(spent24h + priceUsd).toFixed(2)}, over the ${capUsd.toFixed(2)} cap.`); process.exit(3); }

// 3. The simulated server: no money, labelled.
if (pick.extra?.simulated) {
  if (!args.simulated) { console.error('The server is in MODE=simulated (no facilitator). Re-run with --simulated to send X-PAYMENT: simulated; nothing will be paid.'); process.exit(2); }
  const res = await fetch(url, { ...init, headers: { ...init.headers, 'x-payment': 'simulated' } });
  say('status', `${res.status} (SIMULATED: nothing paid, nothing settled)`);
  say('verdict', await res.json());
  process.exit(res.ok ? 0 : 1);
}

// 4. Choose who pays.
const cdpMissing = missing('CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET');
const capAtomic = BigInt(Math.round(capUsd * 1e6));
let client: x402Client;
let payer: string;
if (cdpMissing.length === 0) {
  const cdp = new CdpX402Client({
    environment: 'development',
    walletConfig: { type: 'eoa', accountName: ACCOUNTS.clinic },
    spendControls: { maxAmountPerPayment: { atomic: capAtomic, asset: USDC_BASE_SEPOLIA }, allowedNetworks: [NETWORK] },
  });
  payer = (await cdp.getAddresses()).evmAddress!;
  client = cdp;
  say('paying from', `${payer} (CDP account ${ACCOUNTS.clinic})`);
} else if (process.env.BUYER_PRIVATE_KEY) {
  const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);
  payer = account.address;
  client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  say('paying from', `${payer} (BUYER_PRIVATE_KEY, local signer)`);
  const usdc = await createPublicClient({ chain: baseSepolia, transport: http() }).readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  say('balance', `${formatUnits(usdc, 6)} USDC (Base Sepolia)`);
  if (usdc < BigInt(pick.amount)) {
    console.error(`\nNot paying: ${payer} holds ${formatUnits(usdc, 6)} USDC, the price is ${priceUsd}. Fund it with Base Sepolia test USDC (https://faucet.circle.com, or npm run faucet with CDP keys), then re-run.`);
    process.exit(2);
  }
} else {
  console.error([
    '',
    'Stopped before paying: no wallet to pay with.',
    `  CDP wallet: missing ${cdpMissing.join(', ')} in pill/pay/.env (portal.cdp.coinbase.com → API keys + wallet secret), then npm run faucet.`,
    '  or a local signer: set BUYER_PRIVATE_KEY to a Base Sepolia key that holds test USDC.',
    'The 402 above is the real price list from the server; nothing was signed or sent.',
  ].join('\n'));
  process.exit(2);
}

// 5. Pay and retry (the wrapper signs the 402 option and resends with PAYMENT-SIGNATURE).
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const paid = await fetchWithPayment(url, init);
say('status', `${paid.status} ${paid.statusText}`);
const settledHeader = paid.headers.get('payment-response');
if (settledHeader) {
  const settled = decodePaymentResponseHeader(settledHeader);
  say('settled', { success: settled.success, payer: settled.payer, network: settled.network, transaction: settled.transaction, explorer: settled.transaction ? EXPLORER_TX + settled.transaction : null });
  if (settled.success && settled.transaction) {
    ledger.push({ at: Date.now(), usd: priceUsd, url, tx: settled.transaction });
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  }
} else say('settled', 'no PAYMENT-RESPONSE header (nothing settled)');
say('verdict', await paid.json().catch(() => '(not JSON)'));
process.exit(paid.ok ? 0 : 1);
