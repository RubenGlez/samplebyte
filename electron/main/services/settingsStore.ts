import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { logMain } from './log'

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function readSettings(): Record<string, unknown> {
  const file = settingsPath()
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (error) {
    // The file exists but didn't parse (e.g. truncated by a crash mid-write). Log it rather than
    // silently returning {} and losing the Freesound key with no trace (F29).
    logMain('settings:read-corrupt', error)
    return {}
  }
}

// Write atomically: a full write to a temp file then rename, so a crash mid-write can't truncate
// settings.json and make readSettings() silently fall back to {} (F30).
export function writeSettings(data: Record<string, unknown>): void {
  const file = settingsPath()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}
