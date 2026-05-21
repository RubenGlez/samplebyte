import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getProfile, applyProfileFormat } from '../hardware/profiles'
import { trimSourceToCache } from '../services/trim'
import { configureFfmpeg, ffmpeg } from '../services/ffmpeg'
import type { ExportRegionsParams, TrimSourceParams } from '../../types'

configureFfmpeg()

export function registerAudioHandlers(): void {
  ipcMain.handle('audio:exportRegions', async (_, params: ExportRegionsParams) => {
    const { regions, sourceFilePath, outputDir, profileId } = params
    const profile = getProfile(profileId)

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    await Promise.all(
      regions.map((region, index) =>
        new Promise<void>((resolve, reject) => {
          const outputFile = path.join(outputDir, profile.fileName(index, region.name || `sample_${index + 1}`))

          applyProfileFormat(profile, ffmpeg(sourceFilePath)
            .setStartTime(region.start)
            .setDuration(region.end - region.start))
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', reject)
            .run()
        })
      )
    )

    return { filesWritten: regions.length }
  })

  ipcMain.handle('audio:trimSource', async (_, params: TrimSourceParams) => {
    const { sourceFilePath, start, end } = params
    return trimSourceToCache(sourceFilePath, start, end)
  })
}
