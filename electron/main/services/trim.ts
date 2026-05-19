import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export function trimToWav(input: string, output: string, start: number, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(duration)
      .toFormat('wav')
      .audioFrequency(44100)
      .audioChannels(2)
      .outputOptions(['-sample_fmt s16'])
      .output(output)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

export async function trimSourceToCache(
  sourceFilePath: string,
  start: number,
  end: number
): Promise<{ filePath: string; duration: number }> {
  const duration = end - start
  const sourcesDir = path.join(app.getPath('userData'), 'sources')
  if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })

  const filePath = path.join(sourcesDir, `${crypto.randomUUID()}.wav`)
  await trimToWav(sourceFilePath, filePath, start, duration)
  return { filePath, duration }
}
