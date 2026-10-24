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
python3 - "$DISCORD_BOT_TOKEN" "$chan" "$text" "$here/.channels.json" <<'EOF'
import json, os, re, sys, time, urllib.error, urllib.request
token, chan, text, cache_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
API = "https://discord.com/api/v10"
H = {"Authorization": f"Bot {token}", "Content-Type": "application/json", "User-Agent": "pill-bridge/1"}
def call(req):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(float(e.headers.get("Retry-After", "2")) + 0.5); continue
            raise
    sys.exit("discord: still rate limited")
def get(path):
    return call(urllib.request.Request(API + path, headers=H))
def post(path, body):
    return call(urllib.request.Request(API + path, data=json.dumps(body).encode(), headers=H, method="POST"))
def plain(n):
    return re.sub(r"^[^a-z0-9]+", "", n.lower()).strip("-#")
if chan.isdigit():
    cid = chan
else:
    cache = {}
    if os.path.exists(cache_path):
        cache = json.load(open(cache_path))
    cid = cache.get(plain(chan))
    if not cid:
        cache = {}
        for g in get("/users/@me/guilds"):
            for c in get(f"/guilds/{g['id']}/channels"):
                if c.get("type") == 0:
                    cache[plain(c["name"])] = c["id"]
        json.dump(cache, open(cache_path, "w"))
        cid = cache.get(plain(chan))
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
