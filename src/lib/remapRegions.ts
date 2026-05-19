import type { ProjectRegion } from '@/types'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'

/** Keep chops inside [trimIn, trimOut] and shift times to a 0-based timeline. */
export function remapRegionsForTrim(
  regions: Region[],
  regionNames: Record<string, string>,
  trimIn: number,
  trimOut: number
): ProjectRegion[] {
  const kept: ProjectRegion[] = []

  for (const region of regions) {
    if (region.end <= trimIn || region.start >= trimOut) continue

    const start = Math.max(0, region.start - trimIn)
    const end = Math.min(trimOut - trimIn, region.end - trimIn)
    if (end - start < 0.01) continue

    kept.push({ start, end, name: regionNames[region.id] ?? '' })
  }

  return kept
}
