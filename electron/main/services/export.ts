import path from 'node:path'
import fs from 'node:fs'
import { type HardwareProfile } from '../hardware/profiles'
import { renderClip } from './render'
import { logMain } from './log'

export type ExportClip = {
  sourcePath: string
  // Output position used by the profile's filename convention (region index or pad slot number).
  slotNumber: number
  // Final display name; the profile decides how (or whether) it appears in the filename.
  name: string
  // Trim window into the source. Both null means export the whole source untrimmed.
  start: number | null
  end: number | null
}

// Cap concurrent ffmpeg spawns so a full pack export doesn't launch one process per pad at once
// (F27). Runs each item through the worker with at most `limit` in flight, preserving order.
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const runner = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner))
  return results
}

// Resolve a collision-free filename. Two pads whose display names sanitize to the same string, or an
// empty display name, would otherwise render to the same path in parallel — a silent overwrite
// reported as success (F6). Collisions get a numeric suffix; empty names fall back to the slot.
function uniqueFileName(profile: HardwareProfile, clip: ExportClip, used: Set<string>): string {
  const fileName = profile.fileName(clip.slotNumber, clip.name)
  const ext = path.extname(fileName)
  let base = ext ? fileName.slice(0, -ext.length) : fileName
  if (!base) base = `pad_${clip.slotNumber + 1}`

  let candidate = `${base}${ext}`
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${n}${ext}`
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

const EXPORT_CONCURRENCY = 4

// The single place that knows how a chop becomes a hardware-ready file: it renders each clip to
// outputDir using the profile's container/sample-rate/sample-format and filename convention, and
// reports how many were actually written. Renders are capped-concurrency and independent — one
// failing clip no longer aborts its siblings (F7); the caller surfaces the written/failed counts.
export async function exportClips(
  profile: HardwareProfile,
  clips: ExportClip[],
  outputDir: string
): Promise<{ filesWritten: number; failed: number }> {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const used = new Set<string>()
  const targets = clips.map((clip) => ({ clip, outputFile: path.join(outputDir, uniqueFileName(profile, clip, used)) }))

  const outcomes = await mapLimit(targets, EXPORT_CONCURRENCY, async ({ clip, outputFile }) => {
    try {
      await renderClip(clip.sourcePath, { start: clip.start, end: clip.end }, outputFile, profile.format)
      return true
    } catch (error) {
      logMain('exportClip:failed', error)
      return false
    }
  })

  const filesWritten = outcomes.filter(Boolean).length
  return { filesWritten, failed: outcomes.length - filesWritten }
}
