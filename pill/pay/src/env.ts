// Environment, constants and the local throwaway wallet. Loaded once by every entry point.
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export type Mode = 'cdp' | 'public-facilitator' | 'simulated';

export const NETWORK = 'eip155:84532' as const; // Base Sepolia
export const CDP_NETWORK = 'base-sepolia' as const;
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const PRICE = '$0.05';
export const PRICE_ATOMIC = '50000'; // 0.05 USDC, 6 decimals
export const CDP_FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402';
export const PUBLIC_FACILITATOR = process.env.PUBLIC_FACILITATOR_URL || 'https://x402.org/facilitator';
export const EXPLORER_TX = 'https://sepolia.basescan.org/tx/';
export const PORT = Number(process.env.PORT || 8402);

export const has = {
  cdpKey: Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET),
  walletSecret: Boolean(process.env.CDP_WALLET_SECRET),
  payTo: Boolean(process.env.X402_PAY_TO),
};

/** Names of the env vars a CDP-backed feature still needs. Empty = ready. */
export function missing(...need: ('CDP_API_KEY_ID' | 'CDP_API_KEY_SECRET' | 'CDP_WALLET_SECRET' | 'X402_PAY_TO')[]) {
  return need.filter((k) => !process.env[k]);
}

/**
 * A throwaway Base Sepolia key kept in `.local-wallet.json` (git-ignored). Used as the payTo address when no
 * X402_PAY_TO is set, so the public-facilitator mode has a real address someone on this machine controls.
 */
export function localWallet() {
  const file = fileURLToPath(new URL('../.local-wallet.json', import.meta.url));
  let key: `0x${string}`;
  if (existsSync(file)) key = JSON.parse(readFileSync(file, 'utf8')).privateKey;
  else {
    key = generatePrivateKey();
    writeFileSync(file, JSON.stringify({ note: 'Throwaway Base Sepolia TESTNET key for pill-pay. Never fund with real money.', privateKey: key }, null, 2), { mode: 0o600 });
  }
  return privateKeyToAccount(key);
}
