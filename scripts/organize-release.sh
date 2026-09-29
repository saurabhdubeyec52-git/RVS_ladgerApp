#!/usr/bin/env bash
#
# Sort whatever electron-builder just dropped in release/ into the tidy layout:
#
#   release/
#     installer/   *.dmg  +  RVS-Ledger-Setup-*.exe   (installers)
#     runable/     *-portable.zip                      (unzip & run)
#
# Shared by build-mac.sh, build-win-release.sh and build-all.sh so the moving /
# cleanup rules live in ONE place. Only the current platform's artifacts are in
# release/ root at call time, so handling every artifact type here is harmless —
# it just no-ops for the types this run didn't produce, and leaves the other
# platform's already-organized files (in installer/ and runable/) untouched.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTALLER_DIR="release/installer"
RUNNABLE_DIR="release/runable"

echo "▶ Organizing artifacts"
mkdir -p "$INSTALLER_DIR" "$RUNNABLE_DIR"
shopt -s nullglob
for f in release/*.dmg release/RVS-Ledger-Setup-*.exe; do mv -f "$f" "$INSTALLER_DIR"/; done
for f in release/RVS-Ledger-*-portable.zip; do mv -f "$f" "$RUNNABLE_DIR"/; done

# Drop everything else loose in release/ root (unpacked dirs, blockmaps, *.yml,
# effective-config) so release/ shows only the two organized folders.
find release -maxdepth 1 -mindepth 1 \
  ! -name "$(basename "$INSTALLER_DIR")" \
  ! -name "$(basename "$RUNNABLE_DIR")" \
  -exec rm -rf {} +

echo "── Installers (release/installer) ──"
ls -lah "$INSTALLER_DIR"
echo "── Runnable apps (release/runable) ──"
ls -lah "$RUNNABLE_DIR"
