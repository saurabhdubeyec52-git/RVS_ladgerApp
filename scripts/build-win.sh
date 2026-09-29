#!/usr/bin/env bash
#
# Build the Windows installer(s)/portable zip(s) from macOS for x64.
# better-sqlite3 ships platform-specific Node-API prebuilds in its npm package,
# so electron-builder can package Windows directly without compiling or swapping
# native binaries. Windows ARM64 can also be selected with ARCHES=arm64.
#
# One-time prerequisite on Apple Silicon: a working `wine` + Rosetta, used by
# electron-builder to stamp the .exe icon/version. See README "Build a Windows
# installer on macOS".
#
# Usage:
#   build-win.sh [target ...]              targets default to "nsis" (pass "zip"
#                                          for portable, or "nsis zip" for both)
#   ARCHES="arm64" build-win.sh ...        build Windows ARM64 instead of x64
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(nsis)

# shellcheck disable=SC2206
# shellcheck disable=SC2206
ARCH_LIST=(${ARCHES:-x64})

echo "▶ Bundling renderer/main/preload"
npm run build

export WINEDEBUG=-all
for ARCH in "${ARCH_LIST[@]}"; do
  echo "▶ Packaging Windows '${TARGETS[*]}' $ARCH (bundled Node-API SQLite binary)"
  npx electron-builder --win "${TARGETS[@]}" --"$ARCH"
done

echo "✅ Done. Windows '${TARGETS[*]}' built for: ${ARCH_LIST[*]}. See ./release."
