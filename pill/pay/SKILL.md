---
name: verdict-gated-escrow
description: Hold a supplier payment in USDC escrow on Base Sepolia and release it only when a measurement verdict passes AND a person taps approve; buy missing verdicts from another station over x402 under a spend cap. Use when an agent must gate a payment on an inspection, lab, or test result.
---

# verdict-gated-escrow

Use this skill for payments of the form "pay the supplier only if the goods pass a check, and only after a person approves". Pill uses it for pharmacy deliveries that are screened with a dissolution test. The same pattern fits any inspection, QA or lab verdict.

## When to use

- An agent receives goods together with an invoice, and some endpoint can give a verdict on a sample (`PASS`, `NEEDS LAB` or `UNABLE TO VERIFY`).
- Money should wait in escrow until that verdict is known and a person has looked at it.
- The agent has no local reference for an item and may **buy** a verdict from another station, within a budget.

Don't use it for mainnet funds, or for money that belongs to other people. It is a testnet pattern.

## Install

```bash
cd pill/pay && npm i && cp .env.example .env   # fill CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, X402_PAY_TO
```
It also works without keys. `npm run serve` comes up in `public-facilitator` mode (a real x402 flow through `https://x402.org/facilitator`), and escrow runs `simulated`. Every response carries a `mode` field that says which one you got.

## The two commands

1. **Serve verdicts and escrow:** `npm run serve` (port 8402)
   - `POST /verify` costs $0.05 USDC on `eip155:84532` and returns `{verdict, rule, plateau, band, pct, run_id, mode}`.
   - `POST /escrow/hold|release|refund` takes `{deliveryId, amount}` and returns `{mode, tx, explorer?, moved}`.
   - `GET /health` reports the mode, the facilitator and `payTo`.
2. **Buy a verdict:** `npm run buy -- --url <station>/verify --curve <id> --cap 1.00`
   - It reads the price from the `402` before signing anything, and refuses when the rolling 24 h spend would go over `--cap`.
   - It prints who paid, the requirements, the settled tx from `PAYMENT-RESPONSE`, and the verdict.
   - Without a wallet it exits 2 and names the missing env vars.

## Policy clauses (apply in order; first match wins)

- **P4:** the lot has a recall record → **hold**, whatever the verdict says.
- **P6:** the recall lookup was unreachable or not checked → **hold**.
- **P3:** `UNABLE TO VERIFY` → **escalate** to a person. No money moves.
- **P2:** `NEEDS LAB` → **hold**, and draft a lab referral with the curve attached.
- **P5:** the amount is over $2,000 → **escalate** (the service also refuses a release above the cap).
- **P1:** `PASS`, no recall, within the cap → **propose release**. A release still needs the human tap.

Spend caps: each hold is one delivery's value; each release is at most $2,000; x402 buying is at most 1 USDC per 24 h.

## The human-tap rule

The agent **proposes**, and only a person **releases**. Never call `POST /escrow/release` from an agent loop, a schedule or a retry. Call it only from the handler of a person's explicit approve action, after the proposed outcome is `release`. The agent may downgrade a decision (release → hold or escalate) on its own, but it may never upgrade one.

## Logging and wording

- Write one log line per action, naming the actor, the rule or clause, and the tx hash (or `SIMULATED … nothing moved`).
- Label every amount TESTNET. If `mode` is not `cdp`, say plainly that no funds moved.
- Report verdicts with exactly these words: PASS / NEEDS LAB / UNABLE TO VERIFY. Add "Screening result, not a pharmacopeial test." Never describe a product as safe, genuine, fake, authentic or certified.
