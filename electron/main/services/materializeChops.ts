import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { renderClip, LIBRARY_FORMAT } from './render'
import { isChopSampleStale } from './sourceChange'
import { extractWaveformData, readWavDuration } from '../audio/waveform'
import {
  addSample,
  getAllSamples,
  getMaterializedChopIds,
  refreshChopSample,
  deleteChopSampleRow,
} from '../db/queries/samples'
import { getAllProjectChops, getProject, getProjectChops, markChopMaterializeFailed } from '../db/queries/projects'
import { logMain } from './log'

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
  // Record the duration actually written, not the requested span: a chop dragged past the decoded
  // end yields a shorter file, and mp3 duration jitter can shift the tail (F9).
  const duration = readWavDuration(filePath) ?? end - start
  return { filePath, duration, waveformData: extractWaveformData(filePath) }
}

type Attribution = { freesoundId: string | null; license: string | null; author: string | null }

// Trim one chop to a real WAV and insert it as a library sample (source 'chop') with provenance and,
// when the source is a Freesound download, its attribution so exported packs can credit it (F24).
async function materializeChop(chop: ChopLike, sourcePath: string, attribution?: Attribution): Promise<void> {
  const { filePath, duration, waveformData } = await renderLibrarySample(sourcePath, chop.start, chop.end)
  addSample({
    name: chop.name,
    filePath,
    duration,
    source: 'chop',
    projectId: chop.projectId,
    sourceChopId: chop.id,
    freesoundId: attribution?.freesoundId ?? null,
    license: attribution?.license ?? null,
    author: attribution?.author ?? null,
    waveformData,
    owned: true,
  })
}

// One-time backfill: materialize every existing project chop into the library. Idempotent via
// source_chop_id, so a crash mid-run resumes cleanly and later launches are a no-op. Runs off the
// sync migration path because each chop is an ffmpeg trim.
export async function materializeProjectChops(): Promise<number> {
  const materialized = getMaterializedChopIds()
  const pending = getAllProjectChops().filter(
    (chop) => chop.sourcePath && !materialized.has(chop.id) && !chop.materializeFailed
  )
  if (pending.length === 0) return 0

  let count = 0
  for (const chop of pending) {
    try {
      await materializeChop(chop, chop.sourcePath!, { freesoundId: chop.freesoundId, license: chop.license, author: chop.author })
      count++
    } catch {
      // Source missing/unreadable — record the failure so this doomed render isn't retried on every
      // launch forever (F14).
      markChopMaterializeFailed(chop.id)
    }
  }
  return count
}

// Serialize syncs per project. Multiple renderer paths (autosave upsert, send-to-pack, trim) can
// trigger a sync for the same project while an earlier one is still awaiting ffmpeg; overlapping
// runs both saw "no sample for chop X" and both inserted, duplicating rows and WAVs (F4). Chaining
// per projectId guarantees at most one sync runs for a project at a time.
const syncQueues = new Map<string, Promise<void>>()

export function syncProjectChopsToLibrary(projectId: string): Promise<void> {
  const prev = syncQueues.get(projectId) ?? Promise.resolve()
  const next = prev.then(() => doSyncProjectChopsToLibrary(projectId), () => doSyncProjectChopsToLibrary(projectId))
  syncQueues.set(projectId, next)
  next.finally(() => { if (syncQueues.get(projectId) === next) syncQueues.delete(projectId) })
  return next
}

// Reconcile one project's materialized chop samples with its current chops, so the library stays a
// live projection of the project. Incremental: new chops are trimmed, chops edited since their
// sample was built are re-trimmed (in place, keeping the sample id), and removed chops drop from
// the library. Pack slots are left untouched — packs are independent snapshots.
async function doSyncProjectChopsToLibrary(projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (!project?.sourcePath) return
  const sourcePath = project.sourcePath

  const attribution: Attribution = { freesoundId: project.freesoundId, license: project.license, author: project.author }
  const chops = getProjectChops(projectId)
  const existing = getAllSamples({ projectId }).filter((s) => s.source === 'chop')
  const existingByChopId = new Map(existing.map((s) => [s.sourceChopId, s]))
  const currentChopIds = new Set(chops.map((c) => c.id))

  for (const chop of chops) {
    const sample = existingByChopId.get(chop.id)
    try {
      if (!sample) {
        await materializeChop(chop, sourcePath, attribution)
      } else if (isChopSampleStale(chop, sample)) {
        // Source chop edited since this sample was built — re-trim into a fresh file, swap it in,
        // and drop the stale audio. Same sample id, so pack-slot references stay valid.
        const { filePath, duration, waveformData } = await renderLibrarySample(sourcePath, chop.start, chop.end)
        refreshChopSample(sample.id, { name: chop.name, filePath, duration, waveformData })
        if (sample.filePath !== filePath) {
          try { fs.unlinkSync(sample.filePath) } catch { /* already gone */ }
        }
      }
    } catch (error) {
      // Source unreadable — leave the existing sample as-is rather than abort the whole sync, but
      // leave a trace so a "chop didn't appear in Browse" report is diagnosable (F29).
      logMain('syncProjectChops:chop-failed', error)
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
