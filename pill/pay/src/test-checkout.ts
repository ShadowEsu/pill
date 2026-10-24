// Proves the checkout watcher against the real chain without owning funds: find a recent USDC Transfer on Base Sepolia
// (any sender, any recipient) through the public RPC, open an order whose payTo is that recipient starting one block
// before it, run the watcher, and require that the order turns paid with a tx hash that is really on chain.
//   npm run test:checkout
import { setTimeout } from 'node:timers/promises';
import { formatUnits, parseAbiItem } from 'viem';
import { USDC_BASE_SEPOLIA } from './env.ts';
import { CheckoutBook, RPC_URL, makeClient } from './checkout.ts';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const ZERO = '0x0000000000000000000000000000000000000000';
const say = (label: string, value: unknown) => console.log(`${label.padEnd(14)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const fail = (why: string) => { console.error(`FAIL  ${why}`); process.exit(1); };

const client = makeClient();
const latest = await client.getBlockNumber();
say('rpc', `${RPC_URL}  latest block ${latest}`);

// 1. A real fixture: the newest USDC transfer of at least 0.05 in the last ~500 blocks (200-block calls, the public RPC's limit).
let fixture: { to: `0x${string}`; value: bigint; block: bigint; tx: `0x${string}` } | null = null;
for (let to = latest; to > latest - 600n && !fixture; to -= 200n) {
  const logs = await client.getLogs({ address: USDC_BASE_SEPOLIA, event: TRANSFER, fromBlock: to - 199n, toBlock: to });
  const hit = logs.filter((l) => l.args.to && l.args.to !== ZERO && (l.args.value ?? 0n) >= 50_000n).at(-1);
  if (hit) fixture = { to: hit.args.to!, value: hit.args.value!, block: hit.blockNumber, tx: hit.transactionHash };
}
if (!fixture) fail('no USDC transfer ≥ 0.05 in the last 600 blocks on Base Sepolia; try again in a minute');
const fx = fixture!;
say('fixture', `tx ${fx.tx}  block ${fx.block}  ${formatUnits(fx.value, 6)} USDC → ${fx.to}`);

// 2. Two orders to that recipient, opened one block before the transfer. No file, no timers: we drive the watcher.
// The older "twin" checks that one transfer pays one order (the newest one opened before it), never both.
const book = new CheckoutBook({ client, file: null, autostart: false });
const twin = await book.create({ purpose: 'donation', payTo: fx.to, createdBlock: Number(fx.block) - 1 });
await setTimeout(5);
const order = await book.create({ purpose: 'verify', payTo: fx.to, createdBlock: Number(fx.block) - 1 });
say('order', { id: order.id, status: order.status, amountUsdc: order.amountUsdc, payTo: order.payTo, createdBlock: order.createdBlock });
say('uri', order.uri);

// 3. Watcher passes until paid (one pass is usually enough).
for (let i = 0; i < 5 && book.get(order.id)!.status === 'awaiting'; i++) await book.tick();
const done = book.get(order.id)!;
say('status', done.status);
if (done.status !== 'paid' || !done.paid) fail(`order still ${done.status}${done.lastError ? ` (${done.lastError})` : ''}`);
say('paid', done.paid);

// 4. Independent check: the tx is mined, succeeded, and carries a USDC Transfer to payTo of at least the amount.
const receipt = await client.getTransactionReceipt({ hash: done.paid!.txHash });
const ok = receipt.status === 'success' && receipt.logs.some((l) => l.address.toLowerCase() === USDC_BASE_SEPOLIA.toLowerCase()
  && l.topics[2]?.toLowerCase().endsWith(fx.to.slice(2).toLowerCase()) && BigInt(l.data) >= BigInt(order.amount));
say('receipt', `block ${receipt.blockNumber}  status ${receipt.status}  transfer to payTo ≥ ${order.amountUsdc} USDC: ${ok}`);
if (!ok) fail('receipt does not show the transfer');
if (Number(receipt.blockNumber) !== done.paid!.blockNumber) fail('block number mismatch');

const t = book.get(twin.id)!;
say('twin order', t.status === 'paid' ? `paid by a different transfer ${t.paid!.txHash}` : t.status);
if (t.paid?.txHash === done.paid!.txHash) fail('the same tx paid two orders');

console.log(`PASS  order ${done.id} flipped awaiting → paid from the chain: ${done.paid!.explorer}`);
