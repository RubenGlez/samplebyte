import { useMemo } from 'react'
import { useLibraryStore } from '@/stores/library'
import type { Sample } from '@/types'

// The library is a flat list of real files: local uploads, Freesound downloads, and chops
// materialized from projects (source 'chop'). Project chops are no longer surfaced as virtual
// rows — they enter the library as samples, so every row is a concrete file.
export type LibraryBrowserItem = {
  id: string
  name: string
  filePath: string
  duration: number | null
  bpm: number | null
  musicalKey: string | null
  projectId: string | null
  source: Sample['source']
  sample: Sample
}

export function useFilteredSamples() {
  const { samples, searchQuery, projectFilter, filters } = useLibraryStore()

  return useMemo(() => {
    const items: LibraryBrowserItem[] = samples.map((sample) => ({
      id: `sample:${sample.id}`,
      name: sample.name,
      filePath: sample.filePath,
      duration: sample.duration,
      bpm: sample.bpm,
      musicalKey: sample.musicalKey,
      projectId: sample.projectId,
      source: sample.source,
      sample,
    }))

    return items.filter((item) => {
      if (!item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (projectFilter === '__none__' && item.projectId !== null) return false
      if (projectFilter !== null && projectFilter !== '__none__' && item.projectId !== projectFilter) return false
      if (filters.source && item.source !== filters.source) return false
      if (filters.bpm !== undefined && (item.bpm === null || Math.abs(item.bpm - filters.bpm) > 5)) return false
      if (filters.key && item.musicalKey?.toLowerCase() !== filters.key.toLowerCase()) return false
      return true
    })
  }, [samples, searchQuery, projectFilter, filters])
}
