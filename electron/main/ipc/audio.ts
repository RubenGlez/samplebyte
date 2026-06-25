import { handle } from './handle'
import { getProfile } from '../hardware/profiles'
import { exportClips, type ExportClip } from '../services/export'
import { trimSourceToCache } from '../services/trim'
import { configureFfmpeg } from '../services/ffmpeg'
import type { ExportRegionsParams, TrimSourceParams } from '../../types'

configureFfmpeg()

export function registerAudioHandlers(): void {
  handle('audio:exportRegions', async (_, params: ExportRegionsParams) => {
    const { regions, sourceFilePath, outputDir, profileId } = params
    const profile = getProfile(profileId)

    const clips: ExportClip[] = regions.map((region, index) => ({
      sourcePath: sourceFilePath,
      slotNumber: index,
      name: region.name || `sample_${index + 1}`,
      start: region.start,
      end: region.end,
    }))

    return exportClips(profile, clips, outputDir)
  })

  handle('audio:trimSource', async (_, params: TrimSourceParams) => {
    const { sourceFilePath, start, end } = params
    return trimSourceToCache(sourceFilePath, start, end)
  })
}
