import { create } from 'zustand'
import { withLoading } from './utils'
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
    set({ query, results: [], page: 1, hasMore: false })
    await withLoading(
      (v) => set({ isSearching: v }),
      async () => {
        const data = await window.api.freesound.search(query, 1)
        set({ results: data.results, hasMore: data.next !== null, page: 1 })
      }
    )
  },

  loadMore: async () => {
    const { query, page, isSearching } = get()
    if (isSearching || !query) return
    const nextPage = page + 1
    await withLoading(
      (v) => set({ isSearching: v }),
      async () => {
        const data = await window.api.freesound.search(query, nextPage)
        set((s) => ({
          results: [...s.results, ...data.results],
          hasMore: data.next !== null,
          page: nextPage,
        }))
      }
    )
  },

  startDownload: (id) => set((s) => ({ isDownloading: [...s.isDownloading, id] })),
  endDownload: (id) => set((s) => ({ isDownloading: s.isDownloading.filter((i) => i !== id) })),
}))
