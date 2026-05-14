import { create } from 'zustand'
import type { Sample } from '../../electron/types'

type Filters = {
  bpm?: number
  key?: string
  tags?: string[]
  source?: 'local' | 'freesound'
}

type LibraryState = {
  samples: Sample[]
  searchQuery: string
  filters: Filters
  projectFilter: string | null
  selectedSample: Sample | null
  isLoading: boolean

  fetchSamples: () => Promise<void>
  addSample: (data: { name: string; filePath: string; duration?: number }) => Promise<Sample>
  updateSample: (id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>) => Promise<void>
  deleteSample: (id: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setFilters: (filters: Filters) => void
  setProjectFilter: (projectId: string | null) => void
  toggleTagFilter: (tag: string) => void
  setSelectedSample: (sample: Sample | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  samples: [],
  searchQuery: '',
  filters: {},
  projectFilter: null,
  selectedSample: null,
  isLoading: false,

  fetchSamples: async () => {
    set({ isLoading: true })
    const samples = await window.api.library.getSamples()
    set({ samples, isLoading: false })
  },

  addSample: async (data) => {
    const sample = await window.api.library.addSample(data)
    set((state) => ({ samples: [sample, ...state.samples] }))
    return sample
  },

  updateSample: async (id, data) => {
    await window.api.library.updateSample(id, data)
    set((state) => ({
      samples: state.samples.map((s) => (s.id === id ? { ...s, ...data } : s)),
    }))
  },

  deleteSample: async (id) => {
    await window.api.library.deleteSample(id)
    set((state) => ({
      samples: state.samples.filter((s) => s.id !== id),
      selectedSample: state.selectedSample?.id === id ? null : state.selectedSample,
    }))
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  setProjectFilter: (projectFilter) => set({ projectFilter }),
  toggleTagFilter: (tag) => set((s) => {
    const current = s.filters.tags ?? []
    const tags = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    return { filters: { ...s.filters, tags: tags.length ? tags : undefined } }
  }),
  setSelectedSample: (selectedSample) => set({ selectedSample }),
}))
