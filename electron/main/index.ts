import { app, BrowserWindow, shell, session, protocol, net } from 'electron'
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
  win = new BrowserWindow({
    title: 'SampleByte',
    icon: join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.maximize()

  if (url) {
    win.loadURL(url)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

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
    return net.fetch(pathToFileURL(filePath).href)
  })

  if (!url) {
    // Production-only CSP — not applied in dev so Vite HMR works
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' file: https://cdn.freesound.org; img-src 'self' data:"],
        },
      })
    })
  }

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
