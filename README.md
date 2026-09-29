# RVS Ledger

""
Right-click PowerShell/Terminal → "Run as administrator"
cd "C:\Users\Saurabh Dubey\Downloads\LedgerApp-r1_main\LedgerApp-r1_main"
npm run build:win

 $env:DEBUG = "electron-builder"
>> npm run build:win

""

A desktop app (Electron + React + SQLite) to manage customers, track their
credit/debit ledger, record promised payment dates for pending balances, and get
**in-app + native OS notifications** when a payment becomes overdue.

## Features

- **Admin login** — first launch prompts you to create an admin account; afterwards it asks for credentials. Passwords are stored hashed (bcrypt). Login is required each time the app starts.
- **Dashboard** — at-a-glance KPI cards (Total customers, Ledger transactions, Overdue payments, Pending future-promise payments, Total outstanding). **Each card is clickable** and drills into the detailed list behind it (e.g. Total outstanding → customers who still owe).
- **Customer management** — register customers (name, phone, email, address, area, notes); search, filter by area / balance status, sort, edit, archive (soft-delete) and restore, or permanently delete. Area is auto-derived from the address city when left blank.
- **Credit / debit ledger** — record charges (debit) and payments (credit) per customer with optional photo attachments; outstanding balance is computed automatically. A global **Ledger transactions** view lists every entry across all customers.
- **Promised payment dates** — when a customer hasn't paid in full, record the date they promised to clear the balance. A **Pending payments** view lists all upcoming promises.
- **Overdue alerts** — a scheduler runs on startup, hourly, and on manual refresh. When a promised date passes, the customer is flagged, a native OS notification fires once, and they appear on the **Dashboard** and **Notifications** screens with full details and a one-click call link.
- **Tables everywhere** — serial-number column, sortable headers, search, and area/status filters, with back/forward navigation arrows in the page header.
- **Internationalised** — English and Hindi (हिन्दी) UI, switchable on the fly; light & dark theme.
- **Licensing gate** — an optional expiry date can gate access; once expired the app shows an Expired screen and blocks login until the license is renewed.
- **Read-only database browser** — inspect the live SQLite tables from Settings.

## Requirements

- Node.js 18+ (tested on Node 20)
- macOS / Windows / Linux

### Runtime support

The app ships on **Electron 22** so the Windows builds run on **Windows 7, 8,
8.1, 10 and 11** (both 64-bit and 32-bit). Electron 22 is past end-of-life, so it
no longer receives Chromium security updates — this is a deliberate trade-off to
keep Windows 7 support. If you ever drop Windows 7/8, bump `electron` to a current
release (≥ 28) and `better-sqlite3` back to latest for ongoing security fixes.

## Setup

```bash
npm install      # installs deps and rebuilds better-sqlite3 for Electron
npm run dev      # launch in development with hot reload
```

If the native module ever mismatches Electron's ABI (e.g. after upgrading
Electron), run:

```bash
npm run rebuild
```

## Build a distributable

Artifacts are written to `./release`.

```bash
npm run build:mac   # macOS .dmg (arm64)      -> release/RVS-Ledger-<ver>-arm64.dmg
npm run build:win   # Windows x64 installer    -> release/RVS-Ledger-Setup-<ver>.exe
npm run build:all   # clean + build everything, sorted into installer/ + runable/
```

`npm run build:all` **wipes `./release` first**, then builds both the installers and
the portable apps and sorts them into a tidy layout:

```
release/
  installer/   RVS-Ledger-<ver>-arm64.dmg              macOS installer
               RVS-Ledger-Setup-<ver>-x64.exe          Windows 64-bit installer
               RVS-Ledger-Setup-<ver>-ia32.exe         Windows 32-bit installer
  runable/     RVS-Ledger-<ver>-arm64-portable.zip     macOS  — unzip & run RVS Ledger.app
               RVS-Ledger-<ver>-x64-portable.zip       Windows 64-bit — unzip & run RVS Ledger.exe
               RVS-Ledger-<ver>-ia32-portable.zip      Windows 32-bit — unzip & run RVS Ledger.exe
```

Windows artifacts are built for **x64 and ia32 (32-bit)** so they cover Windows 7
through 11 on either architecture.

### Portable (no-install) builds — run from a zip

Prefer not to install? Build a **portable zip** per OS. Unzip it and run the app
directly — no installer, no admin rights. Output goes to `./release`.

```bash
npm run portable:mac   # -> release/runable/RVS-Ledger-<ver>-arm64-portable.zip
npm run portable:win   # -> release/runable/RVS-Ledger-<ver>-{x64,ia32}-portable.zip
npm run portable       # both of the above
```

- **macOS:** unzip → double-click **`RVS Ledger.app`**. (It's ad-hoc signed, so
  on first run right-click → **Open**, or run `xattr -cr "RVS Ledger.app"` to
  clear the quarantine flag.)
- **Windows:** unzip the folder → run **`RVS Ledger.exe`** inside it. Keep the
  `.exe` together with its sibling files — the whole folder is the app.
  (Unsigned, so Windows SmartScreen may warn: **More info → Run anyway**.)

> There is **no single cross-OS zip**: an Electron app bundles a platform-native
> runtime and the native `better-sqlite3` binary, so macOS and Windows each get
> their own zip. Building the Windows zip from macOS uses the same prebuilt
> Windows binary + `wine` flow described below.

### Build a Windows installer on macOS

`better-sqlite3` is a native module and cannot be cross-compiled from a Mac, so
`npm run build:win` (via `scripts/build-win.sh`) downloads better-sqlite3's
prebuilt **Windows** binary, packages it with `npmRebuild` disabled, then
restores the local macOS binary so `npm run dev` keeps working.

One-time setup on Apple Silicon — electron-builder uses `wine` to stamp the
`.exe` icon/version:

```bash
# Rosetta (if not already present) + wine
softwareupdate --install-rosetta --agree-to-license
brew install --cask wine-stable          # or: brew install wine-staging

# electron-builder looks for wine at a fixed cache path; point it at system wine
WDIR="$HOME/Library/Caches/electron-builder/wine/wine-4.0.1-mac/bin"
mkdir -p "$WDIR"
ln -sf "$(command -v wine)" "$WDIR/wine"
ln -sf "$(command -v wine)" "$WDIR/wine64"
```

> A native, fully-reliable Windows build (and Windows code signing) is best done
> on a Windows machine or CI runner. The local build above is unsigned.

## Where is my data?

The SQLite database lives in Electron's per-user data directory:

- **macOS:** `~/Library/Application Support/RVS Ledger/payment-ledger.db`
- **Windows:** `%APPDATA%/RVS Ledger/payment-ledger.db`
- **Linux:** `~/.config/RVS Ledger/payment-ledger.db`

## Project structure

```
electron/          # main process (Node): DB, repos, services, IPC, preload
  db/              # better-sqlite3 connection + schema
  repositories/    # auth, user, transaction, pending data access
  services/        # overdue scheduler + OS notifications
  ipc/             # ipcMain handlers
src/               # React renderer (pages, components, context)
```

## Concepts

- **Debit** = an amount the customer owes (a charge/bill).
- **Credit** = an amount the customer paid.
- **Outstanding** = total debit − total credit. A positive value means the
  customer still owes money. When a credit clears the balance, any open promise
  is automatically marked paid.
