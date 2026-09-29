import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { getDb, closeDb } from './db/connection.js'
import { registerIpc } from './ipc/handlers.js'
import {
  startOverdueScheduler,
  stopOverdueScheduler,
  runOverdueCheck
} from './services/overdueService.js'
import { startSuperAdminServer, stopSuperAdminServer } from './services/superAdminServer.js'
import { seedDefault as seedSuperAdmin } from './repositories/superAdminRepo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// App icon lives in build/ (electron-builder resources). app.getAppPath() points
// to the project root in dev and the app root when packaged.
const appIcon = join(app.getAppPath(), 'build', 'icon.png')

let mainWindow = null
const getMainWindow = () => mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'RVS Ledger',
    // Only pass the icon if the file exists. When packaged, build/icon.png isn't
    // inside app.asar, and passing a missing path logs a native-image warning.
    // (macOS uses icon.icns from the bundle regardless.)
    ...(existsSync(appIcon) ? { icon: appIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // electron-vite injects this in dev; falls back to built files in production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Re-check overdue whenever the user returns to the app (e.g. after a day
  // rollover) so the data is fresh without a manual refresh.
  mainWindow.on('focus', () => runOverdueCheck(getMainWindow))

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setName('RVS Ledger')
    // macOS ignores BrowserWindow.icon and shows the dock icon from the app
    // bundle (icon.icns) when packaged. Only the dev dock icon needs setting.
    // CRITICAL: app.dock.setIcon() THROWS on a missing/invalid path. Because
    // this runs inside the whenReady() callback *before* createWindow(), an
    // uncaught throw here aborts startup and the window is never created (this
    // is why the packaged app opened with no UI: build/icon.png isn't inside
    // app.asar). Guard with existsSync + try/catch so a bad icon can never
    // prevent the window from opening.
    if (existsSync(appIcon)) {
      try {
        app.dock?.setIcon(appIcon)
      } catch (err) {
        console.warn('Could not set dock icon:', err?.message)
      }
    }
  }

  getDb() // open + migrate before anything queries it
  seedSuperAdmin() // create the vendor super-admin on first run
  registerIpc(getMainWindow)
  createWindow()
  startOverdueScheduler(getMainWindow)
  startSuperAdminServer() // embedded localhost licensing panel

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  stopOverdueScheduler()
  stopSuperAdminServer()
  closeDb()
})
