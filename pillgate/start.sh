#!/usr/bin/env bash
# Pill Gate: start the app for the demo.
#   ./start.sh            live board (auto-finds the UNO Q), Claude on, http://localhost:8000
#   ./start.sh replay     no board: replays runs/SIM_good.csv, badge says REPLAY (not live)
#   ./start.sh online     same as live, plus a public https URL through ngrok (asks for a PIN)
# Stop with Ctrl-C. Logs: app/.serve.log
set -euo pipefail
cd "$(dirname "$0")/app"
MODE="${1:-live}"

if [ ! -x .venv/bin/python ]; then
  echo "setting up Python once..."; uv venv -q --python 3.11 .venv && uv pip install -q -r requirements.txt
fi

KEYFILE="$HOME/.config/preston-secrets/anthropic-pill.env"
if [ -f "$KEYFILE" ]; then set -a; . "$KEYFILE"; set +a; export CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-5}"; echo "Claude: on ($CLAUDE_MODEL)"; else echo "Claude: OFF (no $KEYFILE) - mock mode"; fi
# claude-sonnet-5-5 / opus-5-5 / fable reject the forced tool_choice the backend uses (400 at 19:15 Sat); sonnet-5 accepts it.

# only one program may hold the USB port: stop anything else on it
if [ "$MODE" != "replay" ]; then
  for p in /dev/cu.usbmodem* /dev/cu.usbserial*; do [ -e "$p" ] && lsof -t "$p" 2>/dev/null | xargs -r kill 2>/dev/null || true; done
  if ! ls /dev/cu.usbmodem* >/dev/null 2>&1; then echo "No board found. Plug the UNO Q in (wait ~60 s for it to boot) or run: ./start.sh replay"; fi
fi
lsof -ti :8000 2>/dev/null | xargs -r kill 2>/dev/null || true

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<laptop-ip>')"
echo
echo "  Laptop:  http://localhost:8000"
if [ "$MODE" = "online" ]; then echo "  Phones: use the public link below (the server listens on localhost only in online mode)"; else echo "  Phone (same Wi-Fi): http://$IP:8000"; fi
echo

if [ "$MODE" = "online" ]; then
  # Security review 2026-10-24: online = localhost + ngrok basic auth; profiles backed up (anyone with the PIN could rebuild one);
  # the PIN lives in a 600 config file, not on the command line; the URL comes from ngrok's local API, not a buffered pipe.
  read -r -s -p "PIN for the public link, 8+ characters (judges type user pill + the PIN): " PIN; echo
  while [ ${#PIN} -lt 8 ]; do read -r -s -p "8 characters or more: " PIN; echo; done
  STAMP="$(date +%Y%m%d-%H%M%S)"
  cp -R data/profiles "data/profiles.bak-$STAMP" && echo "  profiles backed up to app/data/profiles.bak-$STAMP (restore after judging)"
  NGCFG="$HOME/.config/preston-secrets/ngrok-pill.yml"
  umask 077; printf 'version: 3\ntunnels:\n  pill:\n    proto: http\n    addr: 127.0.0.1:8000\n    basic_auth:\n      - "pill:%s"\n' "$PIN" > "$NGCFG"; umask 022
  pkill -x ngrok 2>/dev/null || true
  ngrok start pill --config "$HOME/Library/Application Support/ngrok/ngrok.yml" --config "$NGCFG" --log=stdout --log-format=logfmt > .ngrok.log 2>&1 &
  NGPID=$!
  trap 'kill $NGPID 2>/dev/null; pkill -x ngrok 2>/dev/null; rm -f "$NGCFG"' EXIT INT TERM
  ( for i in $(seq 1 30); do sleep 1; U=$(curl -s localhost:4040/api/tunnels | python3 -c "import json,sys; t=json.load(sys.stdin).get('tunnels',[]); print(t[0]['public_url'] if t else '')" 2>/dev/null); [ -n "$U" ] && { echo; echo "  Public:  $U   (user pill + your PIN; keep this up only while judges look)"; echo; break; }; done; grep -q "lvl=eror" .ngrok.log 2>/dev/null && grep "lvl=eror" .ngrok.log | head -2 ) &
  export HOST=127.0.0.1
fi

if [ "$MODE" = "replay" ]; then
  REPLAY_FILE=../runs/SIM_good.csv exec .venv/bin/python server.py
else
  exec .venv/bin/python server.py
fi
