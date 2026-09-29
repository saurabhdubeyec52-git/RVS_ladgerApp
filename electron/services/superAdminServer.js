import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream/promises'
import { BrowserWindow } from 'electron'
import * as superAdminRepo from '../repositories/superAdminRepo.js'
import * as licenseRepo from '../repositories/licenseRepo.js'
import * as authRepo from '../repositories/authRepo.js'
import {
  createAutomaticBackupPath,
  createBackupFile,
  createTemporaryBackupPath,
  restoreBackupFile,
  saveUploadedBackup
} from './dataBackupService.js'

// Embedded localhost-only panel the vendor opens in a browser to manage the
// app's expiry date. Bound to 127.0.0.1 so it is never exposed on the network.
const HOST = '127.0.0.1'

// Preferred port first, then fall back through 3001–3010. We bind to the first
// one that is free.
const PRIMARY_PORT = 3000
const FALLBACK_PORTS = Array.from({ length: 10 }, (_, i) => 3001 + i) // 3001..3010
const CANDIDATE_PORTS = [PRIMARY_PORT, ...FALLBACK_PORTS]

let server = null
let activePort = null // the port we actually bound to (null = not running)
// In-memory session store: token -> { username, createdAt }. Cleared on restart.
const sessions = new Map()
const SESSION_MS = 8 * 60 * 60 * 1000 // 8h

// --- small helpers ---

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(data)
}

function parseCookies(req) {
  const out = {}
  const raw = req.headers.cookie
  if (!raw) return out
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1e6) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function currentSession(req) {
  const token = parseCookies(req).sa_session
  if (!token) return null
  const sess = sessions.get(token)
  if (!sess) return null
  if (Date.now() - sess.createdAt > SESSION_MS) {
    sessions.delete(token)
    return null
  }
  return { token, ...sess }
}

// --- request router ---

async function handleRequest(req, res) {
  // Base only matters for parsing the pathname; the port value is irrelevant here.
  const url = new URL(req.url, `http://${HOST}`)
  const path = url.pathname
  const method = req.method

  // Panel page (no auth — the page itself prompts for login via the API).
  if (method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(PAGE)
    return
  }

  // Login is the only API route reachable without a session.
  if (method === 'POST' && path === '/api/login') {
    try {
      const { username, password } = await readBody(req)
      const user = superAdminRepo.verify(username, password)
      if (!user) return sendJson(res, 401, { error: 'Invalid credentials' })
      const token = crypto.randomBytes(32).toString('hex')
      sessions.set(token, { username: user.username, createdAt: Date.now() })
      res.setHeader(
        'Set-Cookie',
        `sa_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`
      )
      return sendJson(res, 200, { ok: true, username: user.username })
    } catch (err) {
      return sendJson(res, 400, { error: err.message })
    }
  }

  // Everything below requires a valid session.
  const session = currentSession(req)
  if (path.startsWith('/api/')) {
    if (!session) return sendJson(res, 401, { error: 'Not authenticated' })

    try {
      if (method === 'GET' && path === '/api/status') {
        return sendJson(res, 200, { ...licenseRepo.getStatus(), username: session.username })
      }
      if (method === 'GET' && path === '/api/backup') {
        const backupPath = createTemporaryBackupPath()
        try {
          const backup = await createBackupFile(backupPath)
          const date = backup.createdAt.slice(0, 10)
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Length': backup.size,
            'Content-Disposition': `attachment; filename="rvs-ledger-backup-${date}.rvsbackup"`,
            'Cache-Control': 'no-store'
          })
          await pipeline(fs.createReadStream(backupPath), res)
          return
        } finally {
          await fs.promises.rm(backupPath, { force: true }).catch(() => {})
        }
      }
      if (method === 'POST' && path === '/api/backup/restore') {
        const uploadPath = createTemporaryBackupPath()
        const safetyBackupPath = createAutomaticBackupPath()
        try {
          await saveUploadedBackup(req, uploadPath)
          const result = await restoreBackupFile(uploadPath, () =>
            createBackupFile(safetyBackupPath)
          )
          for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) window.webContents.send('data:changed')
          }
          return sendJson(res, 200, {
            ok: true,
            counts: result.counts,
            safetyBackup: safetyBackupPath
          })
        } finally {
          await fs.promises.rm(uploadPath, { force: true }).catch(() => {})
        }
      }
      // Client app account (the single admin who logs into the desktop app).
      if (method === 'GET' && path === '/api/client') {
        return sendJson(res, 200, { ...authRepo.getInfo(), license: licenseRepo.getStatus() })
      }
      if (method === 'POST' && path === '/api/client/password') {
        const { newPassword } = await readBody(req)
        authRepo.resetPassword(newPassword)
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'POST' && path === '/api/client/username') {
        const { username } = await readBody(req)
        authRepo.setUsername(username)
        return sendJson(res, 200, authRepo.getInfo())
      }
      if (method === 'POST' && path === '/api/expiry') {
        const { date } = await readBody(req)
        licenseRepo.setExpiry(date)
        return sendJson(res, 200, licenseRepo.getStatus())
      }
      if (method === 'POST' && path === '/api/expiry/clear') {
        licenseRepo.clearExpiry()
        return sendJson(res, 200, licenseRepo.getStatus())
      }
      if (method === 'POST' && path === '/api/password') {
        const { oldPassword, newPassword } = await readBody(req)
        superAdminRepo.changePassword(oldPassword, newPassword)
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'POST' && path === '/api/logout') {
        sessions.delete(session.token)
        res.setHeader('Set-Cookie', 'sa_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
        return sendJson(res, 200, { ok: true })
      }
    } catch (err) {
      if (res.headersSent) {
        res.destroy(err)
        return
      }
      return sendJson(res, 400, { error: err.message })
    }

    return sendJson(res, 404, { error: 'Not found' })
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
}

// Try to bind `srv` to one specific port. Resolves on success, rejects on error.
// Listeners are one-shot and cleaned up so the server can be retried on another
// port after an EADDRINUSE.
function tryListen(srv, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      srv.removeListener('listening', onListening)
      reject(err)
    }
    const onListening = () => {
      srv.removeListener('error', onError)
      resolve(port)
    }
    srv.once('error', onError)
    srv.once('listening', onListening)
    srv.listen(port, HOST)
  })
}

/**
 * Starts the panel server. Probes CANDIDATE_PORTS in order and binds to the
 * first free one. If every candidate is busy (or another error occurs) it logs
 * and gives up without ever crashing the app — license enforcement does not
 * depend on this server.
 */
export async function startSuperAdminServer() {
  if (server) return
  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      try {
        sendJson(res, 500, { error: err.message || 'Server error' })
      } catch {
        /* response already sent */
      }
    })
  })

  for (const port of CANDIDATE_PORTS) {
    try {
      await tryListen(server, port)
      activePort = port
      console.log(`Super-admin panel: http://${HOST}:${port}`)
      // Long-lived handler for any runtime error after a successful bind.
      server.on('error', (err) => console.warn('Super-admin panel error:', err?.message))
      return
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying next…`)
        continue // try the next candidate
      }
      console.warn('Super-admin panel could not start:', err?.message)
      server = null
      activePort = null
      return
    }
  }

  console.warn(
    `Super-admin panel could not start: all ports busy (${CANDIDATE_PORTS.join(', ')})`
  )
  server = null
  activePort = null
}

export function stopSuperAdminServer() {
  if (server) {
    server.close()
    server = null
  }
  activePort = null
  sessions.clear()
}

/** The URL the panel is currently reachable at, or null if it isn't running. */
export function getSuperAdminUrl() {
  return activePort ? `http://${HOST}:${activePort}` : null
}


// --- self-contained panel page (bundled into out/main by rollup) ---
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RVS Ledger — Super Admin</title>
<style>
  :root {
    --bg:#0b1220; --bg2:#0f172a; --card:#161f33; --card2:#0e1626; --line:#293449;
    --text:#e8edf6; --muted:#93a1b8; --accent:#6366f1; --accent2:#4f46e5;
    --ok:#22c55e; --bad:#ef4444; --warn:#f59e0b;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;
    background:radial-gradient(1200px 600px at 50% -10%, #16213a 0%, var(--bg) 60%); color:var(--text); min-height:100vh; }
  .hidden { display:none !important; }
  h2 { font-size:15px; margin:0; display:flex; align-items:center; gap:8px; }
  label { display:block; font-size:12.5px; color:var(--muted); margin:14px 0 6px; }
  input { width:100%; padding:11px 13px; border-radius:9px; border:1px solid var(--line);
    background:var(--card2); color:var(--text); font-size:14px; outline:none; transition:border-color .15s, box-shadow .15s; }
  input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,.2); }
  button { padding:11px 14px; border:0; border-radius:9px; cursor:pointer; background:var(--accent);
    color:#fff; font-size:14px; font-weight:600; transition:background .15s, opacity .15s, transform .05s; }
  button:hover { background:var(--accent2); }
  button:active { transform:translateY(1px); }
  button:disabled { opacity:.65; cursor:wait; transform:none; }
  button.ghost { background:transparent; border:1px solid var(--line); color:var(--text); }
  button.ghost:hover { background:rgba(255,255,255,.05); }
  button.danger { background:transparent; border:1px solid rgba(239,68,68,.5); color:#fca5a5; }
  button.danger:hover { background:rgba(239,68,68,.12); }
  .full { width:100%; }

  /* Login */
  .login-screen { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .login-card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:30px;
    width:400px; max-width:92vw; box-shadow:0 24px 60px rgba(0,0,0,.5); }
  .brand { display:flex; align-items:center; gap:10px; font-size:18px; font-weight:700; }
  .brand .logo { width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,var(--accent),#22d3ee);
    display:flex; align-items:center; justify-content:center; font-size:16px; }
  .sub { color:var(--muted); font-size:13px; margin:6px 0 6px; }

  /* App shell */
  .topbar { position:sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between;
    padding:14px 22px; background:rgba(11,18,32,.85); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
  .topbar .who { color:var(--muted); font-size:13px; }
  .topbar .who b { color:var(--text); }
  .topbar .right { display:flex; align-items:center; gap:14px; }
  .wrap { max-width:1000px; margin:0 auto; padding:24px 22px 48px; }
  .section-title { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:8px 2px 12px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(310px,1fr)); gap:16px; margin-bottom:26px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
  .card .desc { color:var(--muted); font-size:12.5px; margin:6px 0 0; }
  .card .actions { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; }
  .backup-card { grid-column:1 / -1; }
  .backup-card .desc { max-width:720px; line-height:1.55; }
  .backup-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:18px; }
  .backup-note { display:flex; align-items:flex-start; gap:10px; margin-top:18px; padding:12px 14px;
    border:1px solid rgba(245,158,11,.28); border-radius:10px; background:rgba(245,158,11,.08);
    color:#fcd34d; font-size:12.5px; line-height:1.55; }
  .backup-note-icon { flex:0 0 auto; }
  .backup-note-text { min-width:0; overflow-wrap:anywhere; }
  .backup-note code { color:#fde68a; font:inherit; font-weight:700; }
  .backup-result { margin-top:12px; color:#86efac; font-size:12.5px; line-height:1.5; overflow-wrap:anywhere; }
  .backup-progress { margin-top:18px; padding:14px; border:1px solid var(--line); border-radius:10px; background:var(--card2); }
  .backup-progress[hidden] { display:none; }
  .backup-progress-head { display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:13px; }
  .backup-progress-head strong { color:var(--text); }
  .backup-progress-head span { color:var(--muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
  .progress-track { height:9px; margin-top:11px; overflow:hidden; border-radius:999px; background:#26334b; }
  .progress-fill { width:0; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--accent),#22d3ee); transition:width .15s ease; }
  .progress-fill.indeterminate { width:38%; animation:backup-progress-slide 1.1s ease-in-out infinite alternate; }
  @keyframes backup-progress-slide { from { transform:translateX(-20%); } to { transform:translateX(190%); } }
  .backup-progress-meta { display:flex; justify-content:space-between; gap:12px; margin-top:8px; color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
  @media (max-width:520px) {
    .backup-actions { align-items:stretch; flex-direction:column; }
    .backup-actions button { width:100%; }
    .backup-note { font-size:12px; }
    .backup-progress-meta { flex-direction:column; gap:4px; }
  }

  .kv { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px dashed var(--line); font-size:14px; }
  .kv:last-child { border-bottom:0; }
  .kv .k { color:var(--muted); }
  .kv .v { font-weight:600; text-align:right; }
  .body-pad { margin-top:14px; }

  .pill { display:inline-block; padding:5px 14px; border-radius:999px; font-size:12px; font-weight:800; letter-spacing:.04em; }
  .pill.ok{background:rgba(34,197,94,.18);color:#86efac;border:1px solid rgba(34,197,94,.35)}
  .pill.bad{background:rgba(239,68,68,.18);color:#fca5a5;border:1px solid rgba(239,68,68,.35)}
  .pill.warn{background:rgba(245,158,11,.18);color:#fcd34d;border:1px solid rgba(245,158,11,.4)}
  .warnline { color:#fcd34d; font-size:12.5px; margin-top:12px; display:flex; gap:6px; align-items:flex-start; }

  /* Toast */
  .toast { position:fixed; top:18px; left:50%; transform:translateX(-50%) translateY(-12px);
    padding:11px 18px; border-radius:10px; font-size:14px; font-weight:600; opacity:0; pointer-events:none;
    transition:opacity .2s, transform .2s; box-shadow:0 10px 30px rgba(0,0,0,.4); z-index:50; }
  .toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
  .toast.ok { background:#16341f; color:#86efac; border:1px solid rgba(34,197,94,.4); }
  .toast.err { background:#3a1717; color:#fca5a5; border:1px solid rgba(239,68,68,.4); }
  .msg { margin-top:14px; font-size:13px; padding:9px 11px; border-radius:8px; display:none; }
  .msg.err { display:block; background:rgba(239,68,68,.15); color:#fca5a5; }
</style>
</head>
<body>
  <div id="toast" class="toast"></div>

  <!-- Login -->
  <div id="login" class="login-screen">
    <div class="login-card">
      <div class="brand"><span class="logo">🛡️</span> RVS Ledger</div>
      <div class="sub">Super Admin · Licensing control</div>
      <label>Username</label>
      <input id="u" autocomplete="username" />
      <label>Password</label>
      <input id="p" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')login()" />
      <button class="full" style="margin-top:20px" onclick="login()">Sign in</button>
      <div id="loginMsg" class="msg"></div>
    </div>
  </div>

  <!-- Panel -->
  <div id="panel" class="hidden">
    <div class="topbar">
      <div class="brand"><span class="logo">🛡️</span> RVS Ledger — Super Admin</div>
      <div class="right">
        <span class="who">Signed in as <b id="who"></b></span>
        <button class="danger" onclick="logout()">Sign out</button>
      </div>
    </div>

    <div class="wrap">
      <!-- Overview -->
      <div class="section-title">Overview</div>
      <div class="grid">
        <div class="card">
          <h2>📊 License status</h2>
          <div id="status" class="body-pad">Loading…</div>
        </div>
        <div class="card">
          <h2>👤 Client app account</h2>
          <div id="client" class="body-pad">Loading…</div>
        </div>
      </div>

      <!-- Manage -->
      <div class="section-title">Manage</div>
      <div class="grid">
        <div class="card">
          <h2>📅 Set / extend expiry</h2>
          <p class="desc">The app works through the end of this day, then blocks login.</p>
          <label>Expiry date</label>
          <input id="date" type="date" />
          <div class="actions">
            <button onclick="saveExpiry()">Save expiry</button>
            <button class="ghost" onclick="clearExpiry()">Make unlimited</button>
          </div>
        </div>

        <div class="card">
          <h2>🔑 Reset client password</h2>
          <p class="desc">Set a new login password for the client (no old password needed).</p>
          <label>New client password (min 4 chars)</label>
          <input id="cpw" type="password" />
          <div class="actions">
            <button class="ghost" onclick="resetClientPw()">Reset password</button>
          </div>
        </div>

        <div class="card">
          <h2>✏️ Rename client username</h2>
          <p class="desc">Change the username the client uses to sign in.</p>
          <label>New client username</label>
          <input id="cuser" />
          <div class="actions">
            <button class="ghost" onclick="renameClient()">Rename username</button>
          </div>
        </div>

        <div class="card">
          <h2>🔒 Change super-admin password</h2>
          <p class="desc">Update the password for this panel.</p>
          <label>Current password</label>
          <input id="oldp" type="password" />
          <label>New password (min 6 chars)</label>
          <input id="newp" type="password" />
          <div class="actions">
            <button class="ghost" onclick="changePw()">Update password</button>
          </div>
        </div>

        <div class="card backup-card">
          <h2>💾 Database backup &amp; restore</h2>
          <p class="desc">Move or safeguard customer records, ledger entries, payment promises, history and transaction photos in a single backup file. Your device’s admin accounts and license settings are not included.</p>
          <div class="backup-actions">
            <button id="exportBackupButton" onclick="exportBackup()">⬇ Download backup</button>
            <button id="restoreBackupButton" class="ghost" onclick="$('backupFile').click()">↥ Restore from backup</button>
            <input id="backupFile" type="file" accept=".rvsbackup,.zip,application/zip" hidden onchange="restoreBackup()" />
          </div>
          <div class="backup-note" role="note">
            <span class="backup-note-icon" aria-hidden="true">⚠️</span>
            <span class="backup-note-text"><strong>Before restoring:</strong> this replaces the current customers, transactions, promises and photos on this device. A safety backup is created automatically in the app-data <code>backups</code> folder. Admin accounts and license settings stay unchanged.</span>
          </div>
          <div id="backupProgress" class="backup-progress" role="region" aria-label="Backup transfer progress" hidden>
            <div class="backup-progress-head">
              <strong id="backupProgressLabel">Preparing…</strong>
              <span id="backupProgressPercent">0%</span>
            </div>
            <div id="backupProgressTrack" class="progress-track" role="progressbar" aria-label="Backup transfer" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div id="backupProgressFill" class="progress-fill"></div>
            </div>
            <div class="backup-progress-meta">
              <span id="backupProgressBytes">0 B transferred</span>
              <span id="backupProgressRemaining">Calculating remaining size…</span>
            </div>
          </div>
          <div id="backupResult" class="backup-result" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))
  let toastTimer = null
  function toast(text, ok) {
    const el = $('toast'); el.textContent = text
    el.className = 'toast show ' + (ok ? 'ok' : 'err')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { el.className = 'toast ' + (ok ? 'ok' : 'err') }, 2600)
  }
  function flash(el, text, ok) {
    el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err')
    if (ok) setTimeout(() => { el.className = 'msg' }, 2500)
  }
  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) return '—'
    if (value < 1024) return value + ' B'
    const units = ['KB', 'MB', 'GB']
    let size = value / 1024
    let unit = units[0]
    for (let i = 1; size >= 1024 && i < units.length; i++) { size /= 1024; unit = units[i] }
    return size.toFixed(size < 10 ? 1 : 0) + ' ' + unit
  }
  function updateBackupProgress(label, loaded, total, indeterminate) {
    const panel = $('backupProgress')
    const fill = $('backupProgressFill')
    const percentEl = $('backupProgressPercent')
    const track = $('backupProgressTrack')
    panel.hidden = false
    $('backupProgressLabel').textContent = label
    if (indeterminate || !Number.isFinite(total) || total <= 0) {
      fill.classList.add('indeterminate')
      fill.style.width = ''
      percentEl.textContent = '…'
      track.removeAttribute('aria-valuenow')
      $('backupProgressBytes').textContent = formatBytes(loaded || 0) + ' processed'
      $('backupProgressRemaining').textContent = 'Remaining size unavailable'
      return
    }
    fill.classList.remove('indeterminate')
    const percent = Math.min(100, Math.floor((loaded / total) * 100))
    fill.style.width = percent + '%'
    percentEl.textContent = percent + '%'
    track.setAttribute('aria-valuenow', String(percent))
    $('backupProgressBytes').textContent = formatBytes(loaded) + ' of ' + formatBytes(total)
    $('backupProgressRemaining').textContent = formatBytes(Math.max(0, total - loaded)) + ' remaining'
  }
  function hideBackupProgress() {
    $('backupProgress').hidden = true
  }
  async function api(path, method, body) {
    const res = await fetch(path, {
      method: method || 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }
  const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'

  async function login() {
    try {
      const r = await api('/api/login', 'POST', { username: $('u').value, password: $('p').value })
      $('who').textContent = r.username
      $('login').classList.add('hidden'); $('panel').classList.remove('hidden')
      refresh()
    } catch (e) { flash($('loginMsg'), e.message, false) }
  }
  async function refresh() {
    try {
      const s = await api('/api/status')
      $('who').textContent = s.username
      let pill, label
      if (s.unlimited) { pill = 'ok'; label = 'UNLIMITED' }
      else if (s.expired) { pill = 'bad'; label = 'EXPIRED' }
      else if (s.daysRemaining <= 7) { pill = 'warn'; label = s.daysRemaining + ' DAY' + (s.daysRemaining === 1 ? '' : 'S') + ' LEFT' }
      else { pill = 'ok'; label = 'ACTIVE' }
      let html = '<span class="pill ' + pill + '">' + label + '</span><div style="margin-top:14px"></div>'
      html += kv('Expiry date', s.expiry ? esc(s.expiry) : 'None (unlimited)')
      if (!s.unlimited) html += kv('Days remaining', s.expired ? 'Expired' : s.daysRemaining)
      $('status').innerHTML = html +
        (s.clockRolledBack ? '<div class="warnline">⚠ <span>System clock appears to have been set backwards — treated as expired.</span></div>' : '')
      if (s.expiry) $('date').value = s.expiry
      await refreshClient()
    } catch (e) {
      $('panel').classList.add('hidden'); $('login').classList.remove('hidden')
    }
  }
  async function refreshClient() {
    try {
      const c = await api('/api/client')
      if (!c.hasAdmin) {
        $('client').innerHTML = '<span class="pill warn">NOT SET UP</span>' +
          '<p class="desc" style="margin-top:12px">The client has not created their admin account yet. Reset & rename become available once they do.</p>'
        $('cuser').value = ''
        return
      }
      const lic = c.license.unlimited ? 'Unlimited'
        : (c.license.expired ? 'Expired' : 'Active until ' + esc(c.license.expiry))
      $('client').innerHTML =
        kv('Username', esc(c.username)) +
        kv('Account created', esc(c.createdAt || '—')) +
        kv('License', lic)
      $('cuser').value = c.username
    } catch (e) { $('client').textContent = 'Could not load client account.' }
  }
  async function resetClientPw() {
    try {
      await api('/api/client/password', 'POST', { newPassword: $('cpw').value })
      $('cpw').value = ''; toast('Client password reset', true)
    } catch (e) { toast(e.message, false) }
  }
  async function renameClient() {
    try {
      await api('/api/client/username', 'POST', { username: $('cuser').value })
      toast('Client username updated', true); refreshClient()
    } catch (e) { toast(e.message, false) }
  }
  async function saveExpiry() {
    try { await api('/api/expiry', 'POST', { date: $('date').value }); toast('Expiry saved', true); refresh() }
    catch (e) { toast(e.message, false) }
  }
  async function clearExpiry() {
    try { await api('/api/expiry/clear', 'POST', {}); toast('App set to unlimited', true); refresh() }
    catch (e) { toast(e.message, false) }
  }
  async function changePw() {
    try {
      await api('/api/password', 'POST', { oldPassword: $('oldp').value, newPassword: $('newp').value })
      $('oldp').value = ''; $('newp').value = ''; toast('Super-admin password updated', true)
    } catch (e) { toast(e.message, false) }
  }
  async function exportBackup() {
    const button = $('exportBackupButton')
    button.disabled = true
    button.textContent = 'Preparing backup…'
    $('backupResult').textContent = ''
    updateBackupProgress('Preparing backup file…', 0, 0, true)
    try {
      const { blob, filename } = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', '/api/backup')
        xhr.responseType = 'blob'
        xhr.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : Number(xhr.getResponseHeader('Content-Length'))
          updateBackupProgress('Downloading backup…', event.loaded, total, !total)
        }
        xhr.onerror = () => reject(new Error('Network error while downloading backup.'))
        xhr.onload = async () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            let message = 'Could not create backup'
            try { message = JSON.parse(await xhr.response.text()).error || message } catch {}
            reject(new Error(message))
            return
          }
          const disposition = xhr.getResponseHeader('Content-Disposition') || ''
          const name = disposition.match(/filename="([^"]+)"/)?.[1] || 'rvs-ledger-backup.rvsbackup'
          resolve({ blob: xhr.response, filename: name })
        }
        xhr.send()
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      updateBackupProgress('Backup downloaded', blob.size, blob.size, false)
      $('backupResult').textContent = 'Backup downloaded. Store it somewhere safe.'
      toast('Backup downloaded', true)
    } catch (e) {
      $('backupResult').textContent = e.message
      hideBackupProgress()
      toast(e.message, false)
    } finally {
      button.disabled = false
      button.textContent = '⬇ Download backup'
    }
  }
  async function restoreBackup() {
    const input = $('backupFile')
    const file = input.files && input.files[0]
    if (!file) return
    const confirmed = confirm('Restore this backup? This replaces all customers, transactions, promises, history and photos on this device. Admin logins and license settings are kept. A safety backup is created first.')
    if (!confirmed) { input.value = ''; return }
    const button = $('restoreBackupButton')
    button.disabled = true
    button.textContent = 'Restoring backup…'
    $('backupResult').textContent = ''
    updateBackupProgress('Uploading backup…', 0, file.size, false)
    try {
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/backup/restore')
        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        xhr.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : file.size
          updateBackupProgress('Uploading backup…', event.loaded, total, !total)
          if (event.lengthComputable && event.loaded >= event.total) {
            updateBackupProgress('Upload complete — validating and restoring…', event.loaded, event.total, true)
          }
        }
        xhr.onerror = () => reject(new Error('Network error while uploading backup.'))
        xhr.onload = () => {
          let result = {}
          try { result = JSON.parse(xhr.responseText) } catch {}
          if (xhr.status < 200 || xhr.status >= 300) reject(new Error(result.error || 'Could not restore backup'))
          else resolve(result)
        }
        xhr.send(file)
      })
      updateBackupProgress('Restore complete', file.size, file.size, false)
      $('backupResult').textContent = 'Restore complete. Safety copy saved at: ' + data.safetyBackup
      toast('Data restored successfully', true)
      refresh()
    } catch (e) {
      $('backupResult').textContent = 'Restore failed: ' + e.message
      hideBackupProgress()
      toast(e.message, false)
    } finally {
      input.value = ''
      button.disabled = false
      button.textContent = '↥ Restore from backup'
    }
  }
  async function logout() {
    try { await api('/api/logout', 'POST', {}) } catch {}
    $('panel').classList.add('hidden'); $('login').classList.remove('hidden')
    $('p').value = ''
  }
  // If a session cookie is still valid, jump straight to the panel.
  (async () => {
    try { await api('/api/status'); $('login').classList.add('hidden'); $('panel').classList.remove('hidden'); refresh() } catch {}
  })()
</script>
</body>
</html>`
