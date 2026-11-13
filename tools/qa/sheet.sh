#!/usr/bin/env bash
# Contact sheet: many screenshots → one labelled image (so a reviewer reads 1 image, not 12).
#
#   tools/qa/sheet.sh <out.jpg> [--cols N] [--tile WIDTH] [--title "text"] <img> [<img> …]
#
# Defaults: --cols 3, --tile 640 (px width of each tile). Tiles are labelled with their file names.
# The sheet is capped at 1920 px width so it can be opened directly by reviewers.
set -euo pipefail
OUT="${1:?usage: sheet.sh <out.jpg> [--cols N] [--tile W] [--title T] <images…>}"; shift
COLS=3; TILE=640; TITLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cols) COLS="$2"; shift 2 ;;
    --tile) TILE="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || { echo "sheet.sh: no input images" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
ARGS=(-background '#070A1F' -fill '#C9C6EA' -font DejaVu-Sans -pointsize 15
      -tile "${COLS}x" -geometry "${TILE}x+6+6" -label '%t')
[ -n "$TITLE" ] && ARGS+=(-title "$TITLE")
montage "${ARGS[@]}" "$@" -quality 88 "$OUT"
# keep sheets viewable: at most 1920 px wide
W=$(identify -format '%w' "$OUT")
if [ "$W" -gt 1920 ]; then mogrify -resize 1920x -quality 88 "$OUT"; fi
echo "sheet $OUT ($(identify -format '%wx%h' "$OUT"), $# tiles)"
