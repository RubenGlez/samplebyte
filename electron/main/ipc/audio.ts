import { ipcMain } from 'electron'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'node:path'
import fs from 'node:fs'
import { getProfile } from '../hardware/profiles'
import type { ExportRegionsParams } from '../../types'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export function registerAudioHandlers(): void {
  ipcMain.handle('audio:exportRegions', async (_, params: ExportRegionsParams) => {
    const { regions, sourceFilePath, outputDir, profileId } = params
    const profile = getProfile(profileId)

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    await Promise.all(
      regions.map((region, index) =>
        new Promise<void>((resolve, reject) => {
          const outputFile = path.join(outputDir, profile.fileName(index, region.name || `sample_${index + 1}`))

          ffmpeg(sourceFilePath)
            .setStartTime(region.start)
            .setDuration(region.end - region.start)
            .toFormat(profile.format.container)
            .audioFrequency(profile.format.sampleRate)
            .audioChannels(2)
            .outputOptions([`-sample_fmt ${profile.format.sampleFmt}`])
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', reject)
            .run()
        })
      )
    )

    return { filesWritten: regions.length }
  })
}
