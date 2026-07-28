#!/usr/bin/env bash
# Regenerate extension icons from the web app logo (must be real PNG output for Chrome).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/frontend/public/twerz-logo.png"
OUTDIR="$(cd "$(dirname "$0")" && pwd)/icons"
TMP="$OUTDIR/_source.png"

mkdir -p "$OUTDIR"
sips -s format png "$SRC" --out "$TMP" >/dev/null
for size in 16 32 48 128; do
  sips -z "$size" "$size" "$TMP" --out "$OUTDIR/icon${size}.png" >/dev/null
done
cp "$TMP" "$OUTDIR/twerz-logo.png"
rm -f "$TMP"
echo "Generated icons in $OUTDIR"
