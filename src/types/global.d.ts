import type { Api, ApiEvents } from '../../electron/ipc-contract'

declare global {
  interface Window {
    api: Api & { events: ApiEvents }
  }
}

export {}
