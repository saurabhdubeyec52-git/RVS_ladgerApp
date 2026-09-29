#!/usr/bin/env bash
#
# Build the macOS artifacts and sort them into the tidy release layout:
#
#   release/
#     installer/   RVS-Ledger-<ver>-arm64.dmg          (macOS installer)
#     runable/     RVS-Ledger-<ver>-arm64-portable.zip (unzip & run "RVS Ledger.app")
#
# Unlike build-all.sh this does NOT wipe release/ — it only refreshes the macOS
# artifacts (the shared organize step leaves any existing Windows artifacts in
# place).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Building macOS dmg (installer) + portable zip (runnable)"
npm run build
npx electron-builder --mac dmg zip --arm64

bash scripts/organize-release.sh

echo "✅ macOS done."
