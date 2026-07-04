import { handle } from './handle'
import { readSettings, writeSettings } from '../services/settingsStore'
import { setTelemetryEnabled } from '../services/telemetry'

export function registerSettingsHandlers(): void {
  handle('settings:get', (_, key: string) => readSettings()[key] ?? null)
  handle('settings:set', (_, key: string, value: unknown) => {
    const settings = readSettings()
    settings[key] = value
    writeSettings(settings)
    // Apply a telemetry opt-in/opt-out to the main-process reporter immediately, no restart needed.
    if (key === 'telemetry_enabled') setTelemetryEnabled(value !== false)
  })
}
