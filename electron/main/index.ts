import { app, BrowserWindow, dialog, shell, session, protocol, net, ipcMain } from 'electron'
import { release } from 'node:os'
import { dirname, join } from 'node:path'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
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
const fallbackLogDir = join(__dirname, '../logs')
const emergencyLogPath = '/tmp/samplebyte-main.log'

function getLogPath(): string {
  try {
    return join(app.getPath('logs'), 'main.log')
  } catch {
    return join(fallbackLogDir, 'main.log')
  }
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function logMain(message: string, data?: unknown): void {
  const logPath = getLogPath()
  const suffix = data === undefined ? '' : ` ${typeof data === 'string' ? data : serializeError(data)}`
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`
  try {
    appendFileSync(emergencyLogPath, line)
  } catch {
    // Ignore emergency logging failures.
  }
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, line)
  } catch {
    console.error(line)
  }
}

function showFatalError(title: string, error: unknown): void {
  const detail = serializeError(error)
  const logPath = getLogPath()
  logMain(title, detail)
  try {
    dialog.showErrorBox(title, `${detail}\n\nLog file:\n${logPath}`)
  } catch {
    console.error(title, detail)
  }
}

process.on('uncaughtException', (error) => {
  showFatalError('SampleByte main process uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  showFatalError('SampleByte main process unhandled rejection', reason)
})

process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Must be called before app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// In dev mode the Electron binary runs without a bundle, so app.getName() returns
// "Electron" instead of "samplebyte", which puts userData in the wrong directory.
app.setName('samplebyte')

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
  const splashPath = join(process.env.VITE_PUBLIC!, 'splash.html')
  const iconPath = join(process.env.VITE_PUBLIC!, 'icon.png')

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
  splash.loadFile(splashPath).catch((error) => {
    logMain('splash.loadFile:failed', error)
  })

  win = new BrowserWindow({
    title: 'SampleByte',
    icon: iconPath,
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
    win.loadURL(url).catch((error) => {
      showFatalError('SampleByte failed to load dev URL', error)
    })
  } else {
    win.loadFile(indexHtml).catch((error) => {
      showFatalError('SampleByte failed to load packaged renderer', error)
    })
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
  protocol.handle('local-file', async (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(
      url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname
    )
    // pathToFileURL properly percent-encodes spaces and special chars (e.g. paths under
    // "Application Support"). Plain `file://${filePath}` breaks on macOS userData paths.
    if (!existsSync(filePath)) {
      return new Response('File not found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        },
      })
    }

    try {
      const response = await net.fetch(pathToFileURL(filePath).href)
      const headers = new Headers(response.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch {
      return new Response('Could not load file', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        },
      })
    }
  })

  if (!url) {
    // Production-only CSP — not applied in dev so Vite HMR works
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' local-file: blob: https://freesound.org https://cdn.freesound.org; media-src 'self' file: local-file: blob: https://cdn.freesound.org; img-src 'self' data:"],
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
