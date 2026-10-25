# Pill Gate: security review of the static UI and `start.sh online`

Sat 2026-10-24, 19:45–20:05. Read-only review. I edited no file and made no requests to the running app.

**Scope:**
- `pillgate/app/static/{index.html,app.js,design.css,style.css}`.
- `pillgate/start.sh`.
- The backend (`app/server.py`, `app/evidence.py`), read only for data flow and cost.

**Caveats:**
- AppLook is editing `app.js` right now. Line numbers are from the 19:48 snapshot, so re-grep before fixing.
- Dollar figures assume Sonnet-class pricing ($3 / $15 per million input / output tokens) and $10 per 1,000 web searches **[INFERENCE: I didn't check `claude-sonnet-5` pricing]**.

## Findings, ranked

| # | Sev | Conf | Where | Finding | One-line fix |
|---|---|---|---|---|---|
| 1 | **HIGH** | high (code) | `server.py:538` (`host=os.getenv("HOST","0.0.0.0")`), `start.sh:31-42` | **The PIN only guards the ngrok URL.** The server listens on every interface, and `start.sh` prints the Wi-Fi URL. Anyone on the venue Wi-Fi reaches `:8000` directly, with no PIN, in every mode, `online` included. That means every paid route (#3), profile overwrite (#4), device start/stop and planting #2. | In `start.sh` `online` mode, `export HOST=127.0.0.1` before `exec` (ngrok forwards to localhost, so the public link still works). |
| 2 | **HIGH** | high (sink checked in the vendor code; not run in a browser) | `app.js:1112` `.nodeLabel((n) => n.label)` | **Stored XSS in Atlas.** 3d-force-graph renders a string tooltip as HTML: `"string"==typeof e.content?e.tooltipEl.html(e.content)` in `vendor/3d-force-graph-1.80.0.min.js`. The node labels are raw backend strings (`server.py` `/api/atlas`): a report's `seller` (free text from `POST /api/issues`, `server.py:475`) and the label fields Claude reads off a photo (`drug_name`, `manufacturer`, `lot`). PoC: `POST /api/issues {"scan_id":"<any id from GET /api/scans>","text":"x","seller":"<img src=x onerror=alert(document.domain)>"}`; the script then runs for anyone who hovers that seller node. Same-origin script can call every API with the viewer's basic-auth credentials. | `.nodeLabel((n) => esc(n.label))` |
| 3 | **HIGH** | high on the mechanism, medium on the $ | `server.py:38,396-416,439-446,456-463`; `evidence.py:211-221,384-395,399-412` | **Unmetered paid Claude calls** (no backend rate limit; see "Cost" below). `POST /api/scans` answers 202 at once and queues without a bound. 4 workers keep spending after the attacker stops, until the server restarts. `/ask` forwards a client-supplied `history` (any 6 dicts, any size, straight into `messages`) plus an unbounded `question`. `/issue/draft` is the same with `where`/`when`/`notes`. | Without backend edits: set a **spend limit on the Anthropic workspace/key** in `anthropic-pill.env` before going online. Keep the tunnel up only while judges use it. Optionally rate-limit at ngrok (`--traffic-policy-file` with a `rate-limit` action) **[INFERENCE: I didn't confirm it's on this plan]**. |
| 4 | MEDIUM | high (code) | `server.py:191-201,239-256` | **Anyone with the PIN (or on the LAN, #1) can rewrite verdicts.** `POST /api/run/upload` accepts any CSV as a run. `POST /api/profiles/reference` overwrites any `profile_id` file (e.g. the aspirin reference) and sets its `match_names`. Fake reference curves then make a bad tablet "Passed the screen". | Backend is off-limits. Mitigate with #1 and a short online window. Copy `app/data/profiles/` before going online and diff/restore after. |
| 5 | MEDIUM | medium | `start.sh:33-37` | **Tunnel hygiene.** (a) The PIN is in ngrok's argv, so any local user sees it in `ps`. (b) 8 characters of user-chosen text, and nothing in this script limits guessing. (c) `2>/dev/null` hides ngrok failures (no authtoken, second session on the free plan). (d) `grep -o … \| head -1` writing into a pipe is block-buffered on macOS, so the `Public:` line may never print **[INFERENCE: untested]**. (e) The tunnel isn't tied to the server's life. After Ctrl-C, check `pgrep ngrok`: a leftover tunnel forwards the old PIN to whatever next binds `:8000`. | `PIN=$(openssl rand -base64 12)` and print it. Use `grep --line-buffered`. Drop `2>/dev/null`. In online mode, run the server without `exec` and `trap 'kill 0' EXIT`. |
| 6 | LOW | high | `server.py:446` (`assistant unavailable: {e}`), `server.py:463` (`"warning": str(e)`); shown at `app.js:959` | **Upstream error text reaches the browser.** The Anthropic SDK's error text (request id, rate-limit or "credit balance" wording) is shown in the chat via `textContent`, so there's no XSS. I know of no case where it contains the key **[INFERENCE]**. | UI: show a fixed "The assistant is unavailable right now" instead of `e.message`. Backend: fixed strings (later). |
| 7 | LOW | high | `server.py:407` | **Upload size isn't capped.** `bottle`/`imprint` uploads are written to `data/uploads/` at any size, so disk can fill. The file extension comes from the client but can't contain `/`, so there's no path traversal. | Backend (later); #1 limits who can do it. |
| 8 | LOW | high | `app.js:893` `href="${esc(x.url)}"` | **Source links don't check the URL scheme.** Escaping doesn't block `javascript:` URLs. Today every URL is built on the server (RxNav, openFDA) or comes from a web-search citation limited to regulator domains, so this isn't exploitable now. | Render the link only if `/^https?:\/\//i.test(x.url)`. |
| 9 | LOW | medium | `index.html` (no CSP) | **No CSP.** No inline `<script>` exists, so `script-src 'self'` would also neutralise #2-style `onerror` payloads. | Add `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; base-uri 'none'">`, then re-test Atlas and the charts **[INFERENCE: whether 3d-force-graph needs `blob:`/eval]**. |
| 10 | INFO | high | FastAPI defaults | **`/docs` and `/openapi.json` are public**, so they list every route to anyone with the PIN. | Backend (later): `FastAPI(docs_url=None, openapi_url=None)`. |

## Cost a stranger with the PIN can cause (#3)

| Route | Per call | Rate one script can drive | Per minute |
|---|---|---|---|
| `POST /api/scans` (needs a `run_id`: from `GET /api/runs`, or create one with `POST /api/run/upload`, which is free) | Up to 2 vision calls (≤800 output tokens each). Web research (≤4 searches, `max_uses: 4`, plus search results as input, ≤1200 output tokens). The report (≤900 output tokens). About **$0.15–0.25**. | 4 workers, about 30–90 s per scan. The queue is unbounded: 10,000 queued scans keep spending until restart, about $1.5–2.5k in total. | **~$0.5–2/min, sustained** |
| `POST /api/scans/{id}/ask` | Normal input: about 3k system tokens plus 300 output, about **$0.017**. Padded `question`/`history` up to the model's context (~200k tokens): about **$0.60**. | Sync handlers run in a 40-thread pool. At ~5 s per normal call: ~480 calls/min. | **~$8/min** normal input. **$70–145/min** padded, in theory. In practice the account's input-tokens-per-minute limit caps it first, and that same cap takes the demo down for everyone using the key. |
| `POST /api/scans/{id}/issue/draft` | Same as `/ask` (unbounded `where`/`when`/`notes`, ≤300 output tokens) | Shares the 40-thread pool with `/ask` | Same as `/ask` |

Routes with no Claude call, but with integrity or availability impact:
- `/api/run/start|mark|stop` control the device.
- `/api/run/upload`.
- `/api/profiles/reference|calibration` (#4).
- `/api/issues` (#2's write path).
- `GET /api/scans` and `/api/scans/{id}` show every report to anyone with the PIN.

## What passed

- **XSS in the other views.** Every backend string that goes into `innerHTML` passes through `esc()` (`app.js:16`). That covers:
  - the report `plain_summary`, `what_to_do` and evidence claims;
  - the source ids, kinds and titles;
  - the label and imprint fields;
  - the profile names, ids and `match_names`;
  - the run labels;
  - the stage `why`, gate messages and reasons;
  - the scan id from the URL hash;
  - error messages.

  Constant-only interpolations (copy text, numbers from `/api/config`) are fine.
- **Ask and issue flows.** The user's question and Claude's answer render via `textContent` (`add()`, `app.js:958`), and the read-aloud uses `SpeechSynthesisUtterance`, not HTML. The issue draft goes into a `<textarea>` `.value` (`app.js:1001`), and toasts use `textContent`.
  - Note (low): the chat `history` is held and re-sent by the client, so a caller can put words in the "assistant" turns. That's a grounding issue, and it's part of #3's cost.
- **`localStorage`.** Only `pillgate.mode`, `pillgate.sound` and `pillgate.speak` (`app.js:55-64`). Chats live in memory (`S.chats`), and nothing secret or personal is stored.
- **Secrets.** I grepped the `pillgate/` working tree (including `app/.venv`, `data/`, uploads) and the full git history of `pillgate/` for `sk-ant-`, `AIza` and `ghp_`: **0 hits**. The key is loaded from `~/.config/preston-secrets/anthropic-pill.env`, outside the repo (`start.sh:15`). `/api/config` returns only the app name, the AI flag, the model name and the timings.

## Before `./start.sh online`

1. Bind to localhost in online mode (#1).
2. Escape the Atlas labels (#2).
3. Set a spend limit on the Anthropic key/workspace (#3).
4. Use a random 12+ character PIN and print it (#5).
5. Back up `app/data/profiles/` (#4).
6. Stop the tunnel after judging and check `pgrep ngrok`.
