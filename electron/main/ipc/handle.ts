import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ApiChannels } from '../../ipc-contract'

// Register a main-process handler typed against the IPC contract. The channel name must be a real
// `group:method` from `Api`, and the handler's args and return type are derived from that method's
// signature, so renaming a channel or changing a payload in the contract fails to compile here.
type ChannelHandler<K extends keyof ApiChannels> = ApiChannels[K] extends (...args: infer A) => infer R
  ? (event: IpcMainInvokeEvent, ...args: A) => R | Awaited<R>
  : never

export function handle<K extends keyof ApiChannels>(channel: K, handler: ChannelHandler<K>): void {
  ipcMain.handle(channel as string, handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown)
}
