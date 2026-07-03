import { app } from 'electron'
import { createRequire } from 'node:module'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import { handle } from './ipc/handle'
import { logMain } from './services/log'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater')

export type UpdateCheckResult =
  | { available: boolean; version: string; newVersion?: string }
  | { error: string }

// Wire electron-updater to the renderer. Previously the module registered handlers and sent
// `update-can-available`, but nothing was exposed through the preload bridge, so with context
// isolation the renderer could neither invoke nor receive any of it — the updater was dead code and
// users never got an update prompt (F18). Now the check/download/install verbs and the progress
// events are part of the typed contract and consumed by the UpdateBanner.
export function registerUpdateHandlers(win: Electron.BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    win.webContents.send('update:available', { version: app.getVersion(), newVersion: info?.version })
  })
  autoUpdater.on('download-progress', (info: ProgressInfo) => {
    win.webContents.send('update:progress', info?.percent ?? 0)
  })
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update:downloaded')
  })
  autoUpdater.on('error', (error: Error) => {
    logMain('autoUpdater:error', error)
    win.webContents.send('update:error', error?.message ?? 'Update failed')
  })

  handle('updates:check', async (): Promise<UpdateCheckResult> => {
    // Updates only exist for a packaged, published build; in dev there is nothing to check.
    if (!app.isPackaged) return { available: false, version: app.getVersion() }
    try {
      const result = await autoUpdater.checkForUpdates()
      const newVersion = result?.updateInfo?.version
      return { available: !!newVersion && newVersion !== app.getVersion(), version: app.getVersion(), newVersion }
    } catch (error) {
      logMain('updates:check-failed', error)
      return { error: error instanceof Error ? error.message : 'Update check failed' }
    }
  })

  handle('updates:download', async () => {
    await autoUpdater.downloadUpdate()
  })

  handle('updates:install', async () => {
    // isSilent=false, isForceRunAfter=true: quit, install, relaunch.
    autoUpdater.quitAndInstall(false, true)
  })
}
