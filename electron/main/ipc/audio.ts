import { handle } from './handle'
import { trimSourceToCache } from '../services/trim'
import type { TrimSourceParams } from '../../types'

export function registerAudioHandlers(): void {
  handle('audio:trimSource', async (_, params: TrimSourceParams) => {
    const { sourceFilePath, start, end } = params
    return trimSourceToCache(sourceFilePath, start, end)
  })
}
