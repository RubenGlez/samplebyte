import { app, BrowserWindow, shell, session, protocol, net, ipcMain } from 'electron'
import { release } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { update } from './update'
import { initDatabase } from './db/index'
import { registerLibraryHandlers } from './ipc/library'
import { registerAudioHandlers } from './ipc/audio'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerPacksHandlers } from './ipc/packs'
import { registerSettingsHandlers } from './ipc/settings'
import { registerFreesoundHandlers } from './ipc/freesound'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Must be called before app.ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } },
])

if (release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = join(__dirname, '../preload/index.mjs')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
  const splash = new BrowserWindow({
    width: 320,
    height: 360,
    frame: false,
    backgroundColor: '#1c1c1e',
    resizable: false,
    center: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  splash.loadFile(join(process.env.VITE_PUBLIC!, 'splash.html'))

  win = new BrowserWindow({
    title: 'SampleByte',
    icon: join(process.env.VITE_PUBLIC!, 'icon.png'),
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#1c1c1e',
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(indexHtml)
  }

  const splashShownAt = Date.now()
  win.once('ready-to-show', () => {
    const elapsed = Date.now() - splashShownAt
    const remaining = Math.max(0, 1400 - elapsed)
    setTimeout(() => {
      splash.destroy()
      win?.maximize()
      win?.show()
    }, remaining)
  })

  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('https:')) shell.openExternal(openUrl)
    return { action: 'deny' }
  })

  update(win)
}

app.whenReady().then(() => {
  // Serve local audio files to the renderer without cross-origin restrictions
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-file://'.length))
    // pathToFileURL properly percent-encodes spaces and special chars (e.g. paths under
    // "Application Support"). Plain `file://${filePath}` breaks on macOS userData paths.
    return net.fetch(pathToFileURL(filePath).href)
  })

  if (!url) {
    // Production-only CSP — not applied in dev so Vite HMR works
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' file: local-file: https://cdn.freesound.org; img-src 'self' data:"],
        },
      })
    })
  }

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    if (url.startsWith('https:')) shell.openExternal(url)
  })

  initDatabase()
  registerLibraryHandlers()
  registerAudioHandlers()
  registerFilesystemHandlers()
  registerPacksHandlers()
  registerSettingsHandlers()
  registerFreesoundHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
