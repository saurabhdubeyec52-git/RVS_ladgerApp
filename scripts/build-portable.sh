#!/usr/bin/env bash
#
# Build PORTABLE (no-install) app zips for macOS and Windows into ./release.
#
#   - macOS:   RVS-Ledger-<ver>-arm64-portable.zip   → unzip, run "RVS Ledger.app"
#   - Windows: RVS-Ledger-<ver>-x64-portable.zip      → unzip, run "RVS Ledger.exe"
#
# There is no single cross-OS zip: an Electron app bundles a platform-specific
# runtime and the native better-sqlite3 binary, so each OS needs its own zip.
#
# The Windows zip reuses scripts/build-win.sh (swaps in the prebuilt Windows
# better-sqlite3 binary, then restores the macOS one). See README for the
# one-time wine setup on Apple Silicon.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VER="$(node -e "console.log(require('./package.json').version)")"

RUNNABLE_DIR="release/runable"

echo "▶ Building macOS portable zip"
npm run build
npx electron-builder --mac zip --arm64

echo "▶ Building Windows portable zip"
bash scripts/build-win.sh zip

echo "▶ Moving zips into $RUNNABLE_DIR"
mkdir -p "$RUNNABLE_DIR"
shopt -s nullglob
for f in release/*-portable.zip; do mv "$f" "$RUNNABLE_DIR"/; done

echo "✅ Portable zips in $RUNNABLE_DIR:"
ls -lah "$RUNNABLE_DIR"/RVS-Ledger-"${VER}"-*-portable.zip
