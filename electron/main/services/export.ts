import path from 'node:path'
import fs from 'node:fs'
import { applyProfileFormat, type HardwareProfile } from '../hardware/profiles'
import { ffmpeg } from './ffmpeg'

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

// The single place that knows how a chop becomes a hardware-ready file: it renders each clip to
// outputDir using the profile's container/sample-rate/sample-format and filename convention, runs
// them in parallel, and reports how many were written. The region-export and pack-export IPC
// handlers are thin adapters that build the clip list; the rendering rules live only here.
export async function exportClips(
  profile: HardwareProfile,
  clips: ExportClip[],
  outputDir: string
): Promise<{ filesWritten: number }> {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  await Promise.all(
    clips.map(
      (clip) =>
        new Promise<void>((resolve, reject) => {
          const outputFile = path.join(outputDir, profile.fileName(clip.slotNumber, clip.name))
          const cmd = ffmpeg(clip.sourcePath)
          if (clip.start !== null && clip.end !== null) {
            cmd.setStartTime(clip.start).setDuration(clip.end - clip.start)
          }
          applyProfileFormat(profile, cmd)
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', reject)
            .run()
        })
    )
  )

  return { filesWritten: clips.length }
}
