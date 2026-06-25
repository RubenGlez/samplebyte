import type { Api } from '../../electron/ipc-contract'

declare global {
  interface Window {
    api: Api
  }
}

export {}
