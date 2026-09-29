#!/usr/bin/env bash
#
# Build the Windows installer(s)/portable zip(s) from macOS, for x64 AND ia32
# (32-bit) so the app runs on Windows 7 and up, 32- or 64-bit.
#
# better-sqlite3 is a native module and node-gyp cannot cross-compile it from a
# Mac. For each arch we download better-sqlite3's prebuilt *Windows* binary,
# package it with electron-builder (npmRebuild disabled so it isn't recompiled),
# then restore the local macOS binary so `npm run dev` keeps working. Because the
# native binary differs per arch, each arch is built in its own pass.
#
# One-time prerequisite on Apple Silicon: a working `wine` + Rosetta, used by
# electron-builder to stamp the .exe icon/version. See README "Build a Windows
# installer on macOS".
#
# Usage:
#   build-win.sh [target ...]              targets default to "nsis" (pass "zip"
#                                          for portable, or "nsis zip" for both)
#   ARCHES="x64 ia32" build-win.sh ...     override the arch list (default both)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(nsis)

# shellcheck disable=SC2206
ARCH_LIST=(${ARCHES:-x64 ia32})

SQLITE_DIR="node_modules/better-sqlite3"
SQLITE_BIN="$SQLITE_DIR/build/Release/better_sqlite3.node"
BACKUP="/tmp/better_sqlite3.host-backup.node"

# Read the Electron version we build against so the prebuilt ABI matches.
ELECTRON_VER="$(node -e "console.log(require('./node_modules/electron/package.json').version)")"

echo "▶ Backing up host (macOS) better-sqlite3 binary"
cp "$SQLITE_BIN" "$BACKUP"

restore() {
  echo "▶ Restoring host (macOS) better-sqlite3 binary"
  cp "$BACKUP" "$SQLITE_BIN"
}
trap restore EXIT  # always restore, even if the build fails

echo "▶ Bundling renderer/main/preload"
npm run build

export WINEDEBUG=-all
for ARCH in "${ARCH_LIST[@]}"; do
  echo "▶ Fetching better-sqlite3 Windows $ARCH prebuilt for Electron $ELECTRON_VER"
  rm -f "$SQLITE_BIN"
  ( cd "$SQLITE_DIR" && npx --yes prebuild-install \
      --runtime electron --target "$ELECTRON_VER" \
      --platform win32 --arch "$ARCH" --tag-prefix v )

  echo "▶ Packaging Windows '${TARGETS[*]}' $ARCH (npmRebuild disabled)"
  # The explicit --$ARCH flag is required: naming a target on the CLI otherwise
  # resets the arch to the host (arm64 on Apple Silicon), which would mismatch
  # the Windows binary fetched above.
  npx electron-builder --win "${TARGETS[@]}" --"$ARCH" -c.npmRebuild=false
done

echo "✅ Done. Windows '${TARGETS[*]}' built for: ${ARCH_LIST[*]}. See ./release."
