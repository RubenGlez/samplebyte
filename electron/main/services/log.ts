import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Lightweight file logger shared by main-process services so swallowed errors leave a trail (F29).
// Writes to the same app log directory as the fatal-error path in main/index.ts; a user reporting
// "my library lost samples" then has something to inspect instead of a silent `catch {}`.
function logFilePath(): string {
  try {
    return path.join(app.getPath('logs'), 'main.log')
  } catch {
    return path.join(app.getPath('temp'), 'samplebyte-main.log')
  }
}

export function logMain(message: string, data?: unknown): void {
  let detail = ''
  if (data !== undefined) {
    if (data instanceof Error) detail = ` ${data.name}: ${data.message}`
    else if (typeof data === 'string') detail = ` ${data}`
    else {
      try { detail = ` ${JSON.stringify(data)}` } catch { detail = ` ${String(data)}` }
    }
  }
  const line = `[${new Date().toISOString()}] ${message}${detail}\n`
  try {
    const p = logFilePath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.appendFileSync(p, line)
  } catch {
    console.error(line)
  }
}
