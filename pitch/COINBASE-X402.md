# Coinbase x402: what to do, and what to paste (Sat 2026-10-24, 23:5x PDT)

## What Coinbase asks for (read tonight)

Source: the Coinbase brief "CalHacks: Build agents that trade and pay", linked from the Hive prizes page (https://hive.hackberkeley.org/prizes, which only renders after sign-in; our saved copy is `research/coinbase-x402-track.pdf`). Docs it points to: https://docs.cdp.coinbase.com/x402/welcome and https://docs.cdp.coinbase.com/ai-agents/overview. The Devpost pages (https://cal-hacks-13-0.devpost.com/) answered 403 to my reader, so I couldn't open them.

- **Pick one primary track.** Ours is **Payment Agents**: "Give an agent a way to pay for things, earn money, or both. Use the Coinbase MCP for Agents and x402."
- **How they judge:** Usefulness (a clear problem for an identifiable user), Technical design (does it work reliably, and why these models and tools), Ease of reuse (can someone else install it and do the core task from your instructions), Product feedback (useful, actionable notes on building with Coinbase).
- **What they don't need:** "Real-money transactions are not required. Label simulated actions clearly, keep credentials private, and don't manage funds for other people." They won't score code volume or money spent.
- **What to submit:** a project summary (who it's for, what it does, which agent platform and Coinbase tools), a working example (a short demo plus a repo or hosted link with setup steps), the architecture (components, controls, known limitations) and builder feedback (biggest blocker, the workaround, the one Coinbase capability you most want). All of it goes in the Devpost sponsor box. The brief names no separate Coinbase form and no separate deadline. You can opt into a follow-up call with the Coinbase team.
- **Who can win (per person):** 18 or older, a legal resident of the US or Canada (not Quebec), with an ID-checked Coinbase account in that person's own name, created before entering. Each eligible teammate on the winning team gets $500 USDC and a call with a Coinbase Emerging Talent recruiter. Winners may have to sign an affidavit. A teammate without that account can still be on the team; they just can't take the prize.
- **The one thing we skipped:** the brief says to use the Coinbase MCP for Agents. We used x402 and the CDP SDK directly, not the MCP. The paragraph below says that plainly instead of hiding it.

## What we have right now

- **Real:** `POST /verify` answers a real `402` with a `PAYMENT-REQUIRED` header (0.05 USDC, Base Sepolia). We signed a payment with a fresh local key and the public facilitator's verify step answered `invalid_exact_evm_insufficient_balance`, so signing, header and verify all ran for real.
- **Not yet:** a paid `200` (we've never seen one) and the escrow transfers (they run in `simulated` mode, `moved: false`). Both are waiting on a CDP key. `pill/pay/.env` has no `CDP_*` values at 23:5x.

## What to do tonight or tomorrow (about 20 min, laptop for steps 4 to 8)

1. **Coinbase account (phone, 3 min).** Every teammate who wants the prize signs up at coinbase.com in their own name and finishes the ID check. Without it, that person can't receive the prize, even if we win.
2. **CDP API key (phone or laptop, 3 min).** Go to https://portal.cdp.coinbase.com, sign in with that Coinbase account, then API keys → Create secret API key (https://portal.cdp.coinbase.com/api-keys/secret). Copy the **Key ID** and the **Secret**. The secret is shown once, so paste it into your notes right away.
3. **Wallet secret (2 min).** In the same portal, open Server Wallet → wallet secret (https://portal.cdp.coinbase.com/wallets/non-custodial/security) and generate one. Copy it.
4. **Put the keys in `.env` (laptop, 2 min).** Open `~/calhacks-13/pill/pay/.env` and fill these three lines:
   ```
   CDP_API_KEY_ID=...
   CDP_API_KEY_SECRET=...
   CDP_WALLET_SECRET=...
   ```
   `.env` is git-ignored. Never paste these into Discord, Devpost or a commit.
5. **Start the pay service and get the escrow address (2 min).** The script is `npm run serve` (there's no `npm run dev` in `pill/pay`):
   ```
   cd ~/calhacks-13/pill/pay
   npm run serve
   curl localhost:8402/escrow/accounts
   ```
   Copy the `pill-escrow` address, put it in `.env` as `X402_PAY_TO=0x...`, then stop the service (Ctrl-C) and run `npm run serve` again. The first log line should now name the mode `cdp`.
6. **Test USDC from the faucet (1 min).** In a second terminal, still in `pill/pay`:
   ```
   npm run faucet
   npm run faucet -- --token eth
   ```
   The first sends 1 test USDC to `pill-clinic`, the account that pays. The second gives `pill-clinic` a little test ETH for gas when it moves escrow. The CDP faucet gives 1 USDC per claim, 10 claims a day (https://docs.cdp.coinbase.com/faucets/introduction/welcome). If the script fails, use the portal faucet instead: https://portal.cdp.coinbase.com/products/faucet → Base Sepolia → USDC → paste the `pill-clinic` address → Claim.
7. **Show the real `402` (30 s).** This is the curl from `DEVPOST-FINAL.md`:
   ```
   curl -i -X POST localhost:8402/verify -d '{"curve":"B2-07"}'
   ```
   You want `HTTP/1.1 402` and a `PAYMENT-REQUIRED` header.
8. **Get the paid `200` (1 min).**
   ```
   npm run buy -- --url http://localhost:8402/verify --curve B2-07 --cap 1.00
   ```
   It reads the price from the `402`, checks the 1 USDC cap, pays 0.05 test USDC and should print `200`, the verdict and the settled tx. Open the tx on https://sepolia.basescan.org and copy the link.
9. **Record it (3 min).** Screen-record steps 7 and 8 in one take (under 60 s), with the basescan page at the end. That's the "working example" demo.
10. **Paste and tick (2 min).** On Devpost, tick `[Coinbase] Best Use of x402 by Coinbase`, paste the paragraph below into the Coinbase box and the feedback line into "Share feedback about any technology". **If step 8 printed a `200`:** use the swap-in sentence under the paragraph and add the basescan link. **If you have no key by 08:00:** paste the paragraph as it is. It's honest about the `402` and doesn't claim a paid `200`.

If any step fails, stop there and submit the paragraph as written. A true "pending" beats a claim the judges can't reproduce.

## Devpost: Coinbase sponsor paragraph (paste as is; 119 words)

Primary track: Payment Agents. Pill is for clinic pharmacists deciding whether to pay a supplier for a medicine delivery. Our policy agent holds that payment in escrow, reads the station's verdict on one tablet, checks a six-clause policy file and proposes release, hold or escalate. Only a pharmacist's tap releases money. It earns: each station sells its verdict over x402 (`POST /verify`, 0.05 test USDC, Base Sepolia). It pays: with no local reference, it buys another station's verdict, capped at 1 USDC a day, checked before it signs. We used `@x402/express`, `@x402/evm` and the CDP SDK, not the MCP. Real today: the `402` and the facilitator's verify step. The paid `200` still needs a CDP key. Everything is TESTNET.

**Swap-in, only if step 8 printed a `200`:** replace the last three sentences with "Real today: the `402`, a paid `200` and a settled 0.05 test USDC payment on Base Sepolia: `[FILL: basescan link]`. Everything is TESTNET."

## Devpost: "Share feedback about any technology" (Coinbase line)

Coinbase x402: getting a real `402` out of `@x402/express` was easy and pretty fun, but the paid `200` stalled: no CDP key on our build laptop, and the only keyless test USDC faucet sits behind a reCAPTCHA. Please add a keyless testnet drip and turn on `auth-capture` (already in `@x402/evm`) on the public Base Sepolia facilitator, so our three-wallet escrow could become one x402 route.
