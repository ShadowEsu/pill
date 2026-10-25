#!/usr/bin/env bash
# Pill Gate (the station app): one command for the table.
#
#   ./start.sh            the real deal: the UNO Q on USB, Claude on      → http://localhost:8000
#   ./start.sh demo       the demo: replays our real aspirin run, Claude on → http://localhost:8001
#   ./start.sh both       real deal on :8000 + demo on :8001, in the background, logs in app/.serve*.log
#   ./start.sh reset      stop everything, forget any half-done run, start both again   (the "oh no" button)
#   ./start.sh stop       stop everything (servers + public link)
#   ./start.sh online     real deal + a public https link through ngrok (asks for a PIN, 8+ characters)
#
# The board: if it stops answering, unplug the USB-C cable, wait 5 s, plug it back in, wait ~60 s.
# The app reconnects by itself (it looks for the board every 3 s); the top-right chip shows "no device" until then.
# Ctrl-C stops a foreground server. Phones on the same Wi-Fi use the address printed below.
set -euo pipefail
cd "$(dirname "$0")/app"
MODE="${1:-live}"
DEMO_FILE="${DEMO_FILE:-../runs/REAL_aspirin_first_test.csv}"

setup() {
  if [ ! -x .venv/bin/python ]; then
    echo "setting up Python once..."; uv venv -q --python 3.11 .venv && uv pip install -q -r requirements.txt
  fi
  KEYFILE="$HOME/.config/preston-secrets/anthropic-pill.env"
  if [ -f "$KEYFILE" ]; then set -a; . "$KEYFILE"; set +a; export CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-5}"; echo "Claude: on ($CLAUDE_MODEL)"; else echo "Claude: OFF (no $KEYFILE) - mock mode"; fi
  # claude-sonnet-5-5 / opus-5-5 / fable reject the forced tool_choice the backend uses (400 on Sat 19:15); sonnet-5 accepts it.
}

stop_all() {
  lsof -ti :8000 2>/dev/null | xargs -r kill 2>/dev/null || true
  lsof -ti :8001 2>/dev/null | xargs -r kill 2>/dev/null || true
  pkill -x ngrok 2>/dev/null || true
  for p in /dev/cu.usbmodem* /dev/cu.usbserial*; do [ -e "$p" ] && lsof -t "$p" 2>/dev/null | xargs -r kill 2>/dev/null || true; done
  sleep 1
}

hosts() {
  IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<laptop-ip>')"
  echo
  [ "$1" != "demo" ] && echo "  REAL DEAL (UNO Q):  http://localhost:8000   phone: http://$IP:8000"
  [ "$1" != "live" ] && echo "  DEMO (replay):      http://localhost:8001   phone: http://$IP:8001"
  echo
}

board_note() {
  if ls /dev/cu.usbmodem* >/dev/null 2>&1; then echo "Board: found $(ls /dev/cu.usbmodem* | head -1)"; else echo "Board: not plugged in (the app waits and reconnects by itself)"; fi
}

case "$MODE" in
  stop)
    stop_all; echo "stopped: :8000, :8001, ngrok"; exit 0 ;;
  demo)
    setup; lsof -ti :8001 2>/dev/null | xargs -r kill 2>/dev/null || true; hosts demo
    PORT=8001 REPLAY_FILE="$DEMO_FILE" exec .venv/bin/python server.py ;;
  both|reset)
    setup; stop_all; board_note; hosts both
    nohup .venv/bin/python server.py > .serve.log 2>&1 &
    PORT=8001 REPLAY_FILE="$DEMO_FILE" nohup .venv/bin/python server.py > .serve-demo.log 2>&1 &
    sleep 4
    for p in 8000 8001; do printf "  :%s " "$p"; curl -s "localhost:$p/api/live" | python3 -c "import json,sys; d=json.load(sys.stdin)['status']; print('up ·', d['mode'], '· lines', d['lines'])" 2>/dev/null || echo "not answering yet (see app/.serve*.log)"; done
    [ "$MODE" = "reset" ] && echo "reset done: any half-finished run is forgotten; reload the page in Safari."
    exit 0 ;;
  online)
    setup; lsof -ti :8000 2>/dev/null | xargs -r kill 2>/dev/null || true
    for p in /dev/cu.usbmodem* /dev/cu.usbserial*; do [ -e "$p" ] && lsof -t "$p" 2>/dev/null | xargs -r kill 2>/dev/null || true; done
    board_note
    echo; echo "  Laptop:  http://localhost:8000"; echo "  Phones: use the public link below (the server listens on localhost only in online mode)"; echo
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
    exec .venv/bin/python server.py ;;
  live|*)
    setup; lsof -ti :8000 2>/dev/null | xargs -r kill 2>/dev/null || true
    for p in /dev/cu.usbmodem* /dev/cu.usbserial*; do [ -e "$p" ] && lsof -t "$p" 2>/dev/null | xargs -r kill 2>/dev/null || true; done
    board_note; hosts live
    exec .venv/bin/python server.py ;;
esac
