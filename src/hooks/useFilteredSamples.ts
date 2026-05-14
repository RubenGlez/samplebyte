import { useLibraryStore } from '@/stores/library'

export function useFilteredSamples() {
  const { samples, searchQuery, projectFilter, filters } = useLibraryStore()

  return samples.filter((s) => {
    if (!s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (projectFilter === '__none__' && s.projectId !== null) return false
    if (projectFilter !== null && projectFilter !== '__none__' && s.projectId !== projectFilter) return false
    if (filters.tags?.length && !filters.tags.some((t) => s.tags.includes(t))) return false
    if (filters.source && s.source !== filters.source) return false
    return true
  })
}
