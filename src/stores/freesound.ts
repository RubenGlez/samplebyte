import { create } from 'zustand'
import type { FreesoundResult } from '@/types'

type FreesoundState = {
  query: string
  results: FreesoundResult[]
  page: number
  hasMore: boolean
  isSearching: boolean
  isDownloading: number[]

  search: (query: string) => Promise<void>
  loadMore: () => Promise<void>
  startDownload: (id: number) => void
  endDownload: (id: number) => void
}

export const useFreesoundStore = create<FreesoundState>((set, get) => ({
  query: '',
  results: [],
  page: 1,
  hasMore: false,
  isSearching: false,
  isDownloading: [],

  search: async (query) => {
    set({ query, isSearching: true, results: [], page: 1, hasMore: false })
    try {
      const data = await window.api.freesound.search(query, 1)
      set({ results: data.results, hasMore: data.next !== null, page: 1 })
    } finally {
      set({ isSearching: false })
    }
  },

  loadMore: async () => {
    const { query, page, isSearching } = get()
    if (isSearching || !query) return
    const nextPage = page + 1
    set({ isSearching: true })
    try {
      const data = await window.api.freesound.search(query, nextPage)
      set((s) => ({
        results: [...s.results, ...data.results],
        hasMore: data.next !== null,
        page: nextPage,
      }))
    } finally {
      set({ isSearching: false })
    }
  },

  startDownload: (id) => set((s) => ({ isDownloading: [...s.isDownloading, id] })),
  endDownload: (id) => set((s) => ({ isDownloading: s.isDownloading.filter((i) => i !== id) })),
}))
