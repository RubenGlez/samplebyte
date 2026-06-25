import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { trimToWav } from './trim'
import { extractWaveformData } from '../audio/waveform'
import { addSample, getMaterializedChopIds } from '../db/queries/samples'
import { getAllProjectChops } from '../db/queries/projects'

// One-time backfill: turn every virtual project chop into a real library sample (source 'chop').
// Idempotent via source_chop_id, so a crash mid-run resumes cleanly and later launches are a no-op.
// Runs off the sync migration path because each chop is an ffmpeg trim.
export async function materializeProjectChops(): Promise<number> {
  const materialized = getMaterializedChopIds()
  const pending = getAllProjectChops().filter((chop) => chop.sourcePath && !materialized.has(chop.id))
  if (pending.length === 0) return 0

  const samplesDir = path.join(app.getPath('userData'), 'samples')
  if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true })

  let count = 0
  for (const chop of pending) {
    try {
      const id = crypto.randomUUID()
      const outputPath = path.join(samplesDir, `${id}.wav`)
      await trimToWav(chop.sourcePath!, outputPath, chop.start, chop.end - chop.start)
      addSample({
        name: chop.name,
        filePath: outputPath,
        duration: chop.end - chop.start,
        source: 'chop',
        projectId: chop.projectId,
        sourceChopId: chop.id,
        waveformData: extractWaveformData(outputPath),
      })
      count++
    } catch {
      // Source file missing or unreadable — skip this chop, leave it un-materialized so a later
      // launch retries once the source is available again. Don't abort the whole pass.
    }
  }
  return count
}
