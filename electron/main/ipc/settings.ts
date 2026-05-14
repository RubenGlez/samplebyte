import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function read(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function write(data: Record<string, unknown>): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2))
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_, key: string) => read()[key] ?? null)
  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    const settings = read()
    settings[key] = value
    write(settings)
  })
}
