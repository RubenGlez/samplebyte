import { handle } from './handle'
import { getModelFile, getCachedStems, persistStems } from '../services/stems'
import type { StemPcm } from '../../types'

export function registerStemsHandlers(): void {
  handle('stems:getModelFile', (_, name: string) => getModelFile(name))
  handle('stems:getCached', (_, sourceHash: string) => getCachedStems(sourceHash))
  handle('stems:persist', (_, sourceHash: string, stems: StemPcm[]) => persistStems(sourceHash, stems))
}
