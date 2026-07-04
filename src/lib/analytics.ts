import posthog from 'posthog-js'

// PostHog project key + host. Shared with the SprayDeck project so both apps report into one place,
// distinguished by the `app` super property. Mirror of the constants in
// electron/main/services/telemetry.ts (main process). This is a publishable client write key.
const POSTHOG_KEY = 'phc_pkA7RGnTzMJFP8nt5nEnEystt64MEGujD69XEGJ8NajY'
const POSTHOG_HOST = 'https://us.i.posthog.com'

let started = false

// Telemetry is on by default; a missing setting means enabled. The opt-out toggle lives in Settings.
export async function getTelemetryEnabled(): Promise<boolean> {
  return (await window.api.settings.get('telemetry_enabled')) !== false
}

// Initialize PostHog once, on app start. Autocapture stays OFF: this is an open-source app that
// promises file names never leave the machine, and DOM autocapture can pick up element text (e.g.
// sample names). We report only explicit, safe events plus renderer exceptions.
export async function initAnalytics(): Promise<void> {
  if (started) return
  started = true

  const enabled = (await window.api.settings.get('telemetry_enabled')) !== false
  const distinctId = (await window.api.settings.get('analytics_id')) as string | null

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_exceptions: true, // PostHog Error Tracking for unhandled renderer errors
    persistence: 'localStorage',
    ...(distinctId ? { bootstrap: { distinctID: distinctId } } : {}),
  })
  posthog.register({ app: 'samplebyte' })

  if (enabled) posthog.capture('app_opened')
  else posthog.opt_out_capturing()
}

// Persist the choice and apply it live (no restart needed).
export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  await window.api.settings.set('telemetry_enabled', enabled)
  if (enabled) posthog.opt_in_capturing()
  else posthog.opt_out_capturing()
}
