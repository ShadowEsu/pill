#!/usr/bin/env bash
# Carry ONLY the web UI (app/static/) + start.sh into the kit folder Aaron's hardware setup uses,
# leaving its backend (server.py, device.py, analysis.py, guide.py, evidence.py, store.py, data/, tests/, firmware/) untouched.
#   ./sync-ui-to-peel.sh            → ~/Downloads/peel
#   ./sync-ui-to-peel.sh /path/kit  → another copy of the kit
# First run makes a pristine backup at <kit>-v16-backup (the fail-safe: copy it back over <kit> to revert everything).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KIT="${1:-$HOME/Downloads/peel}"
[ -d "$KIT/app/static" ] || { echo "no kit at $KIT (expected $KIT/app/static)"; exit 1; }
BACKUP="${KIT%/}-v16-backup"
if [ ! -d "$BACKUP" ]; then
  rsync -a --exclude .venv --exclude __pycache__ "$KIT/" "$BACKUP/"
  echo "pristine backup: $BACKUP"
fi
# backend must be identical to the working copy before we touch anything (so the UI was built against the same API)
if ! diff -rq "$KIT/app" "$HERE/app" -x static -x .venv -x __pycache__ -x data -x '.serve*' -x .pytest_cache >/dev/null; then
  echo "STOP: $KIT/app backend differs from $HERE/app backend; compare before syncing:"; diff -rq "$KIT/app" "$HERE/app" -x static -x .venv -x __pycache__ -x data -x '.serve*' -x .pytest_cache || true; exit 2
fi
rsync -a --delete "$HERE/app/static/" "$KIT/app/static/"
cp "$HERE/start.sh" "$KIT/start.sh"; chmod +x "$KIT/start.sh"
mkdir -p "$KIT/docs"; [ -d "$HERE/docs" ] && rsync -a "$HERE/docs/" "$KIT/docs/" || true
[ -d "$HERE/tools" ] && rsync -a --exclude __pycache__ "$HERE/tools/" "$KIT/tools/" || true
echo "UI synced into $KIT/app/static ($(find "$KIT/app/static" -type f | wc -l | tr -d ' ') files); backend untouched:"
diff -rq "$BACKUP/app" "$KIT/app" -x static -x .venv -x __pycache__ -x data -x '.serve*' -x .pytest_cache && echo "  backend == v16 backup (identical)"
echo "Run it there:  cd $KIT && ./start.sh      (or: cd $KIT/app && python server.py)"
