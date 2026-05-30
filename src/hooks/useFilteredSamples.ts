import { useLibraryStore } from '@/stores/library'
import type { ProjectChop, Sample } from '@/types'

export type LibraryBrowserItem =
  | { kind: 'sample'; id: string; name: string; filePath: string; duration: number | null; bpm: number | null; musicalKey: string | null; tags: string[]; projectId: string | null; source: 'local' | 'freesound'; sample: Sample }
  | { kind: 'project-chop'; id: string; name: string; filePath: string; duration: number; bpm: null; musicalKey: null; tags: string[]; projectId: string; projectName: string; source: 'local' | 'freesound'; start: number; end: number; chop: ProjectChop }

export function useFilteredSamples() {
  const { samples, projectChops, searchQuery, projectFilter, filters } = useLibraryStore()

  const items: LibraryBrowserItem[] = [
    ...projectChops
      .filter((chop) => chop.sourcePath)
      .map((chop) => ({
        kind: 'project-chop' as const,
        id: `project-chop:${chop.id}`,
        name: chop.name,
        filePath: chop.sourcePath!,
        duration: chop.end - chop.start,
        bpm: null,
        musicalKey: null,
        tags: [],
        projectId: chop.projectId,
        projectName: chop.projectName,
        source: chop.source,
        start: chop.start,
        end: chop.end,
        chop,
      })),
    ...samples.map((sample) => ({
      kind: 'sample' as const,
      id: `sample:${sample.id}`,
      name: sample.name,
      filePath: sample.filePath,
      duration: sample.duration,
      bpm: sample.bpm,
      musicalKey: sample.musicalKey,
      tags: sample.tags,
      projectId: sample.projectId,
      source: sample.source,
      sample,
    })),
  ]

  return items.filter((item) => {
    if (!item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (projectFilter === '__none__' && item.projectId !== null) return false
    if (projectFilter !== null && projectFilter !== '__none__' && item.projectId !== projectFilter) return false
    if (filters.tags?.length && !filters.tags.some((t) => item.tags.includes(t))) return false
    if (filters.source && item.source !== filters.source) return false
    if (filters.bpm !== undefined && (item.bpm === null || Math.abs(item.bpm - filters.bpm) > 5)) return false
    if (filters.key && item.musicalKey?.toLowerCase() !== filters.key.toLowerCase()) return false
    return true
  })
}
