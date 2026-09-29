#!/usr/bin/env bash
#
# Clean, build EVERYTHING, and sort the results into a tidy release layout:
#
#   release/
#     installer/   RVS-Ledger-<ver>-arm64.dmg          (macOS installer)
#                  RVS-Ledger-Setup-<ver>.exe          (Windows installer)
#     runable/     RVS-Ledger-<ver>-arm64-portable.zip (macOS, unzip & run .app)
#                  RVS-Ledger-<ver>-x64-portable.zip   (Windows, unzip & run .exe)
#
# The whole release/ folder is wiped first. The Windows artifacts are built via
# scripts/build-win.sh (swaps in the prebuilt Windows better-sqlite3 binary, then
# restores the macOS one). See README for the one-time wine setup on Apple Silicon.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTALLER_DIR="release/installer"
RUNNABLE_DIR="release/runable"

echo "▶ Cleaning old build data (release/)"
# macOS Finder/Spotlight can recreate .DS_Store mid-delete, making `rm -rf` fail
# with "Directory not empty"; retry a few times before giving up.
for _ in 1 2 3 4 5; do
  [ -e release ] || break
  rm -rf release 2>/dev/null || true
  sleep 0.4
done
[ -e release ] && { echo "✗ could not remove release/ (is a file in it open?)"; exit 1; }
true

# Build each platform. These scripts each build the installer + runnable and
# sort the results into release/installer and release/runable (they refresh only
# their own platform's artifacts, so running both fills out the layout).
bash scripts/build-mac.sh
bash scripts/build-win-release.sh

echo "✅ Done."
echo "── Installers (release/installer) ──"
ls -lah "$INSTALLER_DIR"
echo "── Runnable apps (release/runable) ──"
ls -lah "$RUNNABLE_DIR"
