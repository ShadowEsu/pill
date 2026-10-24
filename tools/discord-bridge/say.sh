#!/bin/bash
# Post a reply into the team's Discord channel through its webhook.
# Usage: say.sh "text"   or   echo "text" | say.sh
# Splits at 1900 chars (Discord limit is 2000). Webhook URL lives in .env as DISCORD_WEBHOOK_URL.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
set -a; . "$here/.env"; set +a
: "${DISCORD_WEBHOOK_URL:?DISCORD_WEBHOOK_URL missing in $here/.env}"
if [ $# -gt 0 ]; then text="$*"; else text="$(cat)"; fi
[ -n "$text" ] || exit 0
python3 - "$DISCORD_WEBHOOK_URL" "$text" <<'EOF'
import json, sys, urllib.request
url, text = sys.argv[1], sys.argv[2]
chunks, cur = [], ""
for line in text.splitlines(keepends=True):
    if len(cur) + len(line) > 1900:
        chunks.append(cur); cur = ""
    while len(line) > 1900:
        chunks.append(line[:1900]); line = line[1900:]
    cur += line
if cur: chunks.append(cur)
for c in chunks:
    req = urllib.request.Request(url, data=json.dumps({"content": c, "username": "Pill"}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "assay-bridge/1"})
    with urllib.request.urlopen(req, timeout=20) as r:
        r.read()
print(f"posted {len(chunks)} message(s)")
EOF
