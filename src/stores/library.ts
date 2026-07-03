import { create } from 'zustand'
import { analyzeAudioUrl } from '@/lib/audioAnalysis'
import { toLocalFileUrl } from '@/utils'
import { forEachConcurrent, withLoading } from './utils'
import type { Sample } from '../../electron/types'

// How many files to decode + analyse at once during import. Caps memory (each decoded file is
// tens of MB) and roughly matches the analysis worker-pool size.
const ANALYSIS_CONCURRENCY = 4

type Filters = {
  bpm?: number
  key?: string
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
  importFolder: (folderPath: string) => Promise<{ imported: number; skipped: number }>
  setSearchQuery: (query: string) => void
  setFilters: (filters: Filters) => void
  setProjectFilter: (projectId: string | null) => void
  setSelectedSample: (sample: Sample | null) => void
}

// Decode + analyse freshly created samples off the critical path, patching BPM/key/waveform back
// in as each finishes. Fire-and-forget: callers don't await it; the rows just gain their analysed
// fields a moment later. Bounded by ANALYSIS_CONCURRENCY; a failed analysis is non-fatal (the
// sample keeps its un-analysed defaults).
function backfillAnalysis(samples: Sample[], updateSample: LibraryState['updateSample']): void {
  void forEachConcurrent(samples, ANALYSIS_CONCURRENCY, async (sample) => {
    try {
      const analysis = await analyzeAudioUrl(toLocalFileUrl(sample.filePath))
      await updateSample(sample.id, analysis)
    } catch { /* non-fatal */ }
  })
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  samples: [],
  searchQuery: '',
  filters: {},
  projectFilter: null,
  selectedSample: null,
  isLoading: false,

  fetchSamples: () => withLoading(
    (v) => set({ isLoading: v }),
    async () => {
      set({ samples: await window.api.library.getSamples() })
    }
  ),

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

  importFolder: async (folderPath) => {
    const beforeIds = new Set(get().samples.map((s) => s.id))
    const result = await window.api.library.importFolder(folderPath)
    const allSamples = await window.api.library.getSamples()
    set({ samples: allSamples })
    const newSamples = allSamples.filter((s) => !beforeIds.has(s.id))
    backfillAnalysis(newSamples, get().updateSample)
    return result
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  setProjectFilter: (projectFilter) => set({ projectFilter }),
  setSelectedSample: (selectedSample) => set({ selectedSample }),
}))
