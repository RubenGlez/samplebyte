import { randomUUID } from 'node:crypto'
import { PostHog } from 'posthog-node'
import { readSettings, writeSettings } from './settingsStore'

// PostHog project key + host. Shared with the SprayDeck project so both apps report into one place,
// distinguished by the `app` property on every event. Mirror of the constants in
// src/lib/analytics.ts (renderer). This is a publishable client write key, safe to ship.
const POSTHOG_KEY = 'phc_pkA7RGnTzMJFP8nt5nEnEystt64MEGujD69XEGJ8NajY'
const POSTHOG_HOST = 'https://us.i.posthog.com'

let client: PostHog | null = null
let enabled = false
let distinctId = 'anonymous'

// Stable per-install anonymous id, persisted in settings.json and shared with the renderer so a
// main-process crash and the renderer's analytics resolve to the same PostHog person.
function resolveDistinctId(): string {
  const settings = readSettings()
  if (typeof settings.analytics_id === 'string') return settings.analytics_id
  const id = randomUUID()
  writeSettings({ ...settings, analytics_id: id })
  return id
}

function startClient(): void {
  if (client) return
  client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushAt: 1, flushInterval: 0 })
}

// Called once at startup. Telemetry is on by default; a missing/true setting means enabled.
export function initTelemetry(): void {
  distinctId = resolveDistinctId()
  enabled = readSettings().telemetry_enabled !== false
  if (enabled) startClient()
}

// Reflect a live opt-in/opt-out from the Settings toggle without needing a restart.
export function setTelemetryEnabled(next: boolean): void {
  enabled = next
  if (next) startClient()
  else {
    client?.shutdown()
    client = null
  }
}

// Report a main-process exception to PostHog Error Tracking. No-op when telemetry is off. Uses the
// immediate variant so a fatal crash still delivers the event before the process can exit.
export function captureMainException(error: unknown, context: Record<string, unknown> = {}): void {
  if (!enabled || !client) return
  void client.captureExceptionImmediate(error, distinctId, {
    app: 'samplebyte',
    process: 'main',
    ...context,
  })
}

// Flush any queued events. Best-effort; called before the app quits.
export async function flushTelemetry(): Promise<void> {
  try {
    await client?.flush()
  } catch {
    // best effort: never let a telemetry flush failure block quit
  }
}
