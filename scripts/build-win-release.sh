#!/usr/bin/env bash
#
# Build the Windows artifacts and sort them into the tidy release layout:
#
#   release/
#     installer/   RVS-Ledger-Setup-<ver>-x64.exe       (Windows installer, 64-bit)
#     runable/     RVS-Ledger-<ver>-x64-portable.zip     (unzip & run "RVS Ledger.exe")
#
# This wraps scripts/build-win.sh and asks it for BOTH the nsis installer and
# the portable zip. Unlike build-all.sh it does NOT
# wipe release/ — it only refreshes the Windows artifacts (the shared organize
# step leaves any existing macOS artifacts in place).
#
# See README for the one-time wine setup on Apple Silicon.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Building Windows installer (nsis) + portable zip (runnable)"
bash scripts/build-win.sh nsis zip

bash scripts/organize-release.sh

echo "✅ Windows done."
