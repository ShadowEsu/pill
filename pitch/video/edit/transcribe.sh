#!/usr/bin/env bash
# Transcribe the raw pitch audio with Gemini (Files API upload + generateContent).
# Usage: bash pitch/video/edit/transcribe.sh   (from ~/calhacks-13)
# Needs: GEMINI_API_KEY in pill/pay/.env. Writes pitch/video/edit/work/transcript-<model>.json
set -euo pipefail
cd "$(dirname "$0")"
KEY=$(grep -E '^GEMINI_API_KEY=' ../../../pill/pay/.env | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
AUDIO=work/audio.m4a
[ -f "$AUDIO" ] || ffmpeg -hide_banner -loglevel error -y -i ../../video-raw/preston-pitch-raw.mp4 -vn -c copy "$AUDIO"
BYTES=$(wc -c <"$AUDIO" | tr -d ' ')
BASE=https://generativelanguage.googleapis.com

URL=$(curl -sS -D - -o /dev/null "$BASE/upload/v1beta/files?key=$KEY" \
  -H 'X-Goog-Upload-Protocol: resumable' -H 'X-Goog-Upload-Command: start' \
  -H "X-Goog-Upload-Header-Content-Length: $BYTES" -H 'X-Goog-Upload-Header-Content-Type: audio/mp4' \
  -H 'Content-Type: application/json' -d '{"file":{"display_name":"preston-pitch-audio"}}' \
  | awk -F': ' 'tolower($1)=="x-goog-upload-url"{print $2}' | tr -d '\r')
curl -sS "$URL" -H "Content-Length: $BYTES" -H 'X-Goog-Upload-Offset: 0' -H 'X-Goog-Upload-Command: upload, finalize' \
  --data-binary "@$AUDIO" >work/file.json
FURI=$(python3 -c 'import json;print(json.load(open("work/file.json"))["file"]["uri"])')
echo "uploaded: $FURI"
sleep 3

PROMPT='Transcribe this audio verbatim (English). It is a 179-second hackathon pitch recorded outdoors at night. Return ONLY JSON: {"segments":[{"start":"M:SS.s","end":"M:SS.s","text":"..."}]} with one segment per sentence or short phrase (max ~8 seconds each), timestamps measured from the start of the audio, exact words including false starts and filler words (um, uh). Do not summarise, do not fix grammar, do not invent words; mark unclear audio as [inaudible].'
BODY=$(python3 -c 'import json,sys;print(json.dumps({"contents":[{"parts":[{"file_data":{"mime_type":"audio/mp4","file_uri":sys.argv[1]}},{"text":sys.argv[2]}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}))' "$FURI" "$PROMPT")

for M in gemini-2.5-flash gemini-3.1-flash-lite gemini-3.5-flash-lite; do
  echo "trying $M"
  curl -sS "$BASE/v1beta/models/$M:generateContent?key=$KEY" -H 'Content-Type: application/json' -d "$BODY" >"work/resp-$M.json" || true
  if python3 - "work/resp-$M.json" "work/transcript-$M.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
t=r["candidates"][0]["content"]["parts"][0]["text"]
j=json.loads(t); assert j["segments"]
json.dump(j,open(sys.argv[2],"w"),indent=1); print("ok", len(j["segments"]), "segments")
PY
  then echo "MODEL=$M"; exit 0; fi
  head -c 400 "work/resp-$M.json"; echo
done
echo "ALL MODELS FAILED"; exit 1
