#!/bin/sh
# Real station photos (photos/station/*.jpg, taken Sat) → figma/art/station/*.webp for build-deck.mjs, plus the
# figma/assets/*.jpg cache entries build-deck.mjs reads. Crops with ffmpeg (sips -c ignores --cropOffset when one side
# keeps its full length), webp with cwebp, cache JPEGs with sips.
# Photos with people in the background (station-08, -081, -10, -102) are left out on purpose. station-17 and -171 lose
# their top 324 px (a handwritten name on a paper, top right); station-19 loses its top 140 px (a hand).
# Usage (repo root): sh figma/station-photos.sh, then node figma/build-deck.mjs
set -e
cd "$(dirname "$0")/.."
SRC=photos/station; OUT=figma/art/station; CACHE=figma/assets; TMP=$(mktemp -d)
mkdir -p "$OUT" "$CACHE"
webp() { cwebp -quiet -q 80 "$1" -o "$2"; }
crop() { ffmpeg -v error -y -i "$1" -vf "crop=$3" -q:v 2 "$2"; } # in out w:h:x:y
# privacy crops first: every later step reads these
crop "$SRC/station-17.jpg" "$TMP/station-17.jpg" 768:700:0:324
crop "$SRC/station-171.jpg" "$TMP/station-171.jpg" 768:700:0:324
crop "$SRC/station-19.jpg" "$TMP/station-19.jpg" 768:884:0:140
cp "$SRC/station-191.jpg" "$TMP/station-191.jpg"
# full frames for the Design file's gallery
for n in 17 171 19 191; do webp "$TMP/station-$n.jpg" "$OUT/station-$n.webp"; done
# slide 4 crops, 768×628 (the 440×360 frame's aspect): side box + chamber + UNO Q; top view with blue light in the cup
crop "$TMP/station-19.jpg" "$TMP/led-box.jpg" 768:628:0:190
crop "$TMP/station-171.jpg" "$TMP/blue-cup.jpg" 768:628:0:0
webp "$TMP/led-box.jpg" "$OUT/slide-led-box.webp"
webp "$TMP/blue-cup.jpg" "$OUT/slide-blue-cup.webp"
# the chamber blueprint's top view (left part of pillgate/diagrams/03_chamber_cross_sections.png, stopping before "SIDE VIEW")
ffmpeg -v error -y -i pillgate/diagrams/03_chamber_cross_sections.png -vf crop=975:867:0:0 "$TMP/top-view.png"
webp "$TMP/top-view.png" "$OUT/chamber-top-view.webp"
# cache entries: figma/assets/<id>-q<q>.jpg, named exactly as img() in build-deck.mjs names them
cache() { # src-webp width cap-suffix q
  id=$(echo "$1" | sed -e 's/\.[a-z]*$//' -e 's/[^a-zA-Z0-9]\{1,\}/-/g')-$2$3
  sips -s format jpeg -s formatOptions 55 --resampleWidth "$2" "$1" --out "$CACHE/$id-q$4.jpg" >/dev/null
}
cache "$OUT/slide-led-box.webp" 768 "" 5
cache "$OUT/slide-blue-cup.webp" 768 "" 5
cache "$OUT/chamber-top-view.webp" 1060 "" 5
for n in 17 171 19 191; do cache "$OUT/station-$n.webp" 390 c 12; done
cache "$OUT/chamber-top-view.webp" 640 "" 12
rm -rf "$TMP"
ls -la "$OUT"
