import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { renderClip, LIBRARY_FORMAT } from './render'

// Trim a source span into a cached library-format WAV used by the chop editor's preview/playback.
export async function trimSourceToCache(
  sourceFilePath: string,
  start: number,
  end: number
): Promise<{ filePath: string; duration: number }> {
  const sourcesDir = path.join(app.getPath('userData'), 'sources')
  if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })

  const filePath = path.join(sourcesDir, `${crypto.randomUUID()}.wav`)
  await renderClip(sourceFilePath, { start, end }, filePath, LIBRARY_FORMAT)
  return { filePath, duration: end - start }
}
