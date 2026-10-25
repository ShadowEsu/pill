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
if [ -f "$KEYFILE" ]; then set -a; . "$KEYFILE"; set +a; echo "Claude: on (${CLAUDE_MODEL:-claude-sonnet-5-5})"; else echo "Claude: OFF (no $KEYFILE) - mock mode"; fi

# only one program may hold the USB port: stop anything else on it
if [ "$MODE" != "replay" ]; then
  for p in /dev/cu.usbmodem* /dev/cu.usbserial*; do [ -e "$p" ] && lsof -t "$p" 2>/dev/null | xargs -r kill 2>/dev/null || true; done
  if ! ls /dev/cu.usbmodem* >/dev/null 2>&1; then echo "No board found. Plug the UNO Q in (wait ~60 s for it to boot) or run: ./start.sh replay"; fi
fi
lsof -ti :8000 2>/dev/null | xargs -r kill 2>/dev/null || true

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<laptop-ip>')"
echo
echo "  Laptop:  http://localhost:8000"
echo "  Phone (same Wi-Fi): http://$IP:8000"
echo

if [ "$MODE" = "online" ]; then
  read -r -p "PIN for the public link, 8+ characters (judges type user pill + the PIN): " PIN
  while [ ${#PIN} -lt 8 ]; do read -r -p "8 characters or more: " PIN; done
  ( sleep 2; ngrok http 8000 --basic-auth "pill:$PIN" --log=stdout --log-format=logfmt 2>/dev/null \
      | grep -o 'url=https://[^ ]*' | head -1 | sed 's/url=/  Public:  /' ) &
fi

if [ "$MODE" = "replay" ]; then
  REPLAY_FILE=../runs/SIM_good.csv exec .venv/bin/python server.py
else
  exec .venv/bin/python server.py
fi
