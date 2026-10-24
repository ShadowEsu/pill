# Pill app

Vite + React 19 + TypeScript. Light mode. Phone (tab bar) and desktop (sidebar) from one build.
The station does the measuring; this app shows the curve, the verdict (PASS / NEEDS LAB / UNABLE TO VERIFY), the rule that fired, and in clinic mode the payment the verdict holds. Money is SANDBOX / TESTNET.

## Run it at the booth (full stack, laptop)

```sh
# 1. the pay/AI service (port 8402): x402 seller, escrow, Claude why/Ask/escrow clerk, Gemini label reading, calendar bridge
cd pill/pay && npm install && cp -n .env.example .env   # fill the keys you have; everything without a key reports "unavailable"
nohup npm run serve > .serve.log 2>&1 &

# 2. the app (port 5183)
cd pill/web && npm install
printf 'VITE_PAY_URL=http://127.0.0.1:8402\n' > .env.local
npx vite --port 5183 --strictPort
```

Open http://127.0.0.1:5183/welcome. For the kiosk screen on the Pi: `/kiosk` at 1024×600, attract mode after 30 s idle.

## Routes worth showing

| Route | What |
|---|---|
| `/welcome` | choose Medical or Personal |
| `/demo` | 2-minute guided tour (the chalk tablet → NEEDS LAB → payment held); `?speed=2` |
| `/story` | 7 chapters, swipe or arrow keys |
| `/` | Dashboard (medical) or Home (personal) |
| `/bottle` → `/place` → `/run/new?replay=TM-02` | Prepare, then the station's six phases on the rail (lights off 3 s → clear water 10 s → drop → dissolving → settling → verdict); the moment: cloudy chalk reaches the band, no glow → N2 |
| `/run/new?replay=B2-07` | a PASS; replays play the dark and clear-water phases first and end where the station would, when the 20-s plateau window closes |
| `/station` | the station hub: online · simulated · offline, the run on it now (live rail), temperature, last blank, last 5 runs, how a run works |
| `/evaluation/:id` | verdict, two channels, Claude why (filtered), read aloud, share card |
| `/delivery/:id` | escrow, policy clauses, release on a tap, Nessie mirror |
| `/agent` | the policy agent's record: counts, limits, the 6-case downgrade-only test, where it could go wrong |
| `/ask` | Ask Pill (Claude, answers only from Pill's record; refusals) |
| `/verify` | the real x402 402 from the service |
| `/settings` | sound, big text, calendar status, reset demo data |

Replay keys: `B2-07` PASS/P1, `TM-02` NEEDS LAB/N2, `B2-LID` UNABLE/U2 (lid opened), `AMX-01` UNABLE/U1 (no reference).

## Phone build (Vercel)

Production builds ship with `VITE_PAY_URL` empty (`.env.production.local`), so no model or payment call leaves the phone and no key is in the bundle; those screens show `demo` / `unavailable`. Deploy: `npx vercel build --prod --yes && npx vercel deploy --prebuilt --prod --yes --scope shadowesus-projects`, then grep `.vercel/output/static` for key patterns before trusting it.

## Checks

`npx tsc -b` (types), `npx vite build`. Headless smoke: every route at 390×844 and 1280×800 with 0 console errors and `scrollWidth` equal to the viewport; screenshots live in `dev-shots/`.

## Honesty rules baked in

Verdict words are exactly PASS / NEEDS LAB / UNABLE TO VERIFY. The app never says safe, verified, authentic, certified, guaranteed, fake, genuine or counterfeit; model text passes a clause filter on the service. The model can only make a decision more careful; release is a person's tap. Red is used only for recalls and holds. Demo data is labelled as such.
