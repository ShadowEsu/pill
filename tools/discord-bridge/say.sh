#!/bin/bash
# Post a reply into a channel of the PILL category as the bot.
# Usage: say.sh <channel-name-or-id> "text"      or      echo "text" | say.sh <channel>
# Splits at 1900 chars (Discord limit 2000). Needs DISCORD_BOT_TOKEN in .env.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
set -a; . "$here/.env"; set +a
: "${DISCORD_BOT_TOKEN:?DISCORD_BOT_TOKEN missing in $here/.env}"
chan="${1:?usage: say.sh <channel> \"text\"}"; shift
if [ $# -gt 0 ]; then text="$*"; else text="$(cat)"; fi
[ -n "$text" ] || exit 0
python3 - "$DISCORD_BOT_TOKEN" "$chan" "$text" <<'EOF'
import json, re, sys, urllib.request
token, chan, text = sys.argv[1], sys.argv[2], sys.argv[3]
API = "https://discord.com/api/v10"
H = {"Authorization": f"Bot {token}", "Content-Type": "application/json", "User-Agent": "pill-bridge/1"}
def get(path):
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=H), timeout=20) as r:
        return json.load(r)
def post(path, body):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers=H, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)
if chan.isdigit():
    cid = chan
else:
    cid = None
    for g in get("/users/@me/guilds"):
        for c in get(f"/guilds/{g['id']}/channels"):
            if c.get("type") == 0 and re.sub(r"^[^a-z0-9]+", "", c["name"].lower()).strip("-") == re.sub(r"^[^a-z0-9]+", "", chan.lower()).strip("-#"):
                cid = c["id"]; break
        if cid: break
    if not cid:
        sys.exit(f"channel {chan} not found")
chunks, cur = [], ""
for line in text.splitlines(keepends=True):
    if len(cur) + len(line) > 1900:
        chunks.append(cur); cur = ""
    while len(line) > 1900:
        chunks.append(line[:1900]); line = line[1900:]
    cur += line
if cur: chunks.append(cur)
for c in chunks:
    post(f"/channels/{cid}/messages", {"content": c})
print(f"posted {len(chunks)} message(s) to #{chan}")
EOF
