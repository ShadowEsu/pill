#!/bin/sh
# Real station photos (photos/station/*.jpg, taken Sat) → figma/art/station/*.webp for build-deck.mjs, plus the
# figma/assets/*.jpg cache entries build-deck.mjs would otherwise make with ffmpeg. Uses only sips + cwebp.
# Photos with people in the background (station-08, -081, -10, -102) are left out on purpose.
# Usage (repo root): sh figma/station-photos.sh, then node figma/build-deck.mjs
set -e
cd "$(dirname "$0")/.."
SRC=photos/station; OUT=figma/art/station; CACHE=figma/assets; TMP=$(mktemp -d)
mkdir -p "$OUT" "$CACHE"
webp() { cwebp -quiet -q 80 "$1" -o "$2"; }
# full frames for the Design file's gallery
for n in 17 171 19 191; do webp "$SRC/station-$n.jpg" "$OUT/station-$n.webp"; done
# slide 4 crops, 768×628 (the 440×360 frame's aspect): side box + chamber + UNO Q; top view with blue light in the cup
sips -c 628 768 --cropOffset 330 0 "$SRC/station-19.jpg" --out "$TMP/led-box.jpg" >/dev/null
sips -c 628 768 --cropOffset 250 0 "$SRC/station-171.jpg" --out "$TMP/blue-cup.jpg" >/dev/null
webp "$TMP/led-box.jpg" "$OUT/slide-led-box.webp"
webp "$TMP/blue-cup.jpg" "$OUT/slide-blue-cup.webp"
# the chamber blueprint's top view (left half of pillgate/diagrams/03_chamber_cross_sections.png)
sips -c 867 1060 --cropOffset 0 0 pillgate/diagrams/03_chamber_cross_sections.png --out "$TMP/top-view.png" >/dev/null
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
