import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { renderClip, LIBRARY_FORMAT } from './render'
import { isChopSampleStale } from './sourceChange'
import { extractWaveformData } from '../audio/waveform'
import {
  addSample,
  getAllSamples,
  getMaterializedChopIds,
  refreshChopSample,
  deleteChopSampleRow,
} from '../db/queries/samples'
import { getAllProjectChops, getProject, getProjectChops } from '../db/queries/projects'

type ChopLike = { id: string; projectId: string; name: string; start: number; end: number }

function ensureSamplesDir(): string {
  const dir = path.join(app.getPath('userData'), 'samples')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Render a source span into a fresh library-format WAV under the samples dir and read its waveform.
// The shared trim-half behind every library sample: standalone saved chops (library.saveChops),
// project-chop projections (materializeChop), and re-trims after a source chop changes.
export async function renderLibrarySample(
  sourcePath: string,
  start: number,
  end: number
): Promise<{ filePath: string; duration: number; waveformData: number[] }> {
  const filePath = path.join(ensureSamplesDir(), `${crypto.randomUUID()}.wav`)
  await renderClip(sourcePath, { start, end }, filePath, LIBRARY_FORMAT)
  return { filePath, duration: end - start, waveformData: extractWaveformData(filePath) }
}

// Trim one chop to a real WAV and insert it as a library sample (source 'chop') with provenance.
async function materializeChop(chop: ChopLike, sourcePath: string): Promise<void> {
  const { filePath, duration, waveformData } = await renderLibrarySample(sourcePath, chop.start, chop.end)
  addSample({
    name: chop.name,
    filePath,
    duration,
    source: 'chop',
    projectId: chop.projectId,
    sourceChopId: chop.id,
    waveformData,
  })
}

// One-time backfill: materialize every existing project chop into the library. Idempotent via
// source_chop_id, so a crash mid-run resumes cleanly and later launches are a no-op. Runs off the
// sync migration path because each chop is an ffmpeg trim.
export async function materializeProjectChops(): Promise<number> {
  const materialized = getMaterializedChopIds()
  const pending = getAllProjectChops().filter((chop) => chop.sourcePath && !materialized.has(chop.id))
  if (pending.length === 0) return 0

  let count = 0
  for (const chop of pending) {
    try {
      await materializeChop(chop, chop.sourcePath!)
      count++
    } catch {
      // Source missing/unreadable — skip, leave un-materialized so a later run retries.
    }
  }
  return count
}

// Reconcile one project's materialized chop samples with its current chops, so the library stays a
// live projection of the project. Incremental: new chops are trimmed, chops edited since their
// sample was built are re-trimmed (in place, keeping the sample id), and removed chops drop from
// the library. Pack slots are left untouched — packs are independent snapshots.
export async function syncProjectChopsToLibrary(projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (!project?.sourcePath) return
  const sourcePath = project.sourcePath

  const chops = getProjectChops(projectId)
  const existing = getAllSamples({ projectId }).filter((s) => s.source === 'chop')
  const existingByChopId = new Map(existing.map((s) => [s.sourceChopId, s]))
  const currentChopIds = new Set(chops.map((c) => c.id))

  for (const chop of chops) {
    const sample = existingByChopId.get(chop.id)
    try {
      if (!sample) {
        await materializeChop(chop, sourcePath)
      } else if (isChopSampleStale(chop, sample)) {
        // Source chop edited since this sample was built — re-trim into a fresh file, swap it in,
        // and drop the stale audio. Same sample id, so pack-slot references stay valid.
        const { filePath, duration, waveformData } = await renderLibrarySample(sourcePath, chop.start, chop.end)
        refreshChopSample(sample.id, { name: chop.name, filePath, duration, waveformData })
        if (sample.filePath !== filePath) {
          try { fs.unlinkSync(sample.filePath) } catch { /* already gone */ }
        }
      }
    } catch {
      // Source unreadable — leave the existing sample as-is rather than abort the whole sync.
    }
  }

  for (const sample of existing) {
    if (sample.sourceChopId && !currentChopIds.has(sample.sourceChopId)) {
      const filePath = deleteChopSampleRow(sample.id)
      if (filePath) {
        try { fs.unlinkSync(filePath) } catch { /* already gone */ }
      }
    }
  }
}
