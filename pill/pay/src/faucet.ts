// npm run faucet [-- --token eth]  → Base Sepolia test funds for the pill-clinic CDP account (credentials required).
import { parseArgs } from 'node:util';
import { missing } from './env.ts';
import { faucet } from './escrow.ts';

const { values } = parseArgs({ options: { token: { type: 'string', default: 'usdc' } } });
const need = missing('CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET');
if (need.length) {
  console.error(`npm run faucet needs CDP credentials: missing ${need.join(', ')} in pill/pay/.env (portal.cdp.coinbase.com → API keys + wallet secret).`);
  process.exit(2);
}
if (values.token !== 'usdc' && values.token !== 'eth') { console.error('--token must be usdc or eth'); process.exit(1); }
const r = await faucet('clinic', values.token);
console.log(`faucet → ${r.name} ${r.address}\n  ${r.token.toUpperCase()} (Base Sepolia, TESTNET) tx ${r.tx}\n  ${r.explorer}`);
