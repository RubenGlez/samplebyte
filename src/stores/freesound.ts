import { create } from 'zustand'
import { withLoading } from './utils'
import type { FreesoundResult } from '@/types'

export type FreesoundSort = 'score' | 'downloads_desc' | 'rating_desc' | 'created_desc'
export type FreesoundDuration = 'any' | 'short' | 'medium' | 'long'

const DURATION_FILTER: Record<FreesoundDuration, string> = {
  any: '',
  short: 'duration:[0 TO 5]',
  medium: 'duration:[5 TO 30]',
  long: 'duration:[30 TO *]',
}

type FreesoundState = {
  query: string
  sort: FreesoundSort
  durationFilter: FreesoundDuration
  results: FreesoundResult[]
  page: number
  hasMore: boolean
  isSearching: boolean
  isDownloading: number[]

  search: (query: string) => Promise<void>
  setSort: (sort: FreesoundSort) => void
  setDurationFilter: (d: FreesoundDuration) => void
  loadMore: () => Promise<void>
  startDownload: (id: number) => void
  endDownload: (id: number) => void
}

export const useFreesoundStore = create<FreesoundState>((set, get) => ({
  query: '',
  sort: 'score',
  durationFilter: 'any',
  results: [],
  page: 1,
  hasMore: false,
  isSearching: false,
  isDownloading: [],

  search: async (query) => {
    const { sort, durationFilter } = get()
    set({ query, results: [], page: 1, hasMore: false })
    await withLoading(
      (v) => set({ isSearching: v }),
      async () => {
        const data = await window.api.freesound.search(query, 1, sort, DURATION_FILTER[durationFilter])
        set({ results: data.results, hasMore: data.next !== null, page: 1 })
      }
    )
  },

  setSort: (sort) => {
    set({ sort })
    const { query } = get()
    if (query) get().search(query)
  },

  setDurationFilter: (durationFilter) => {
    set({ durationFilter })
    const { query } = get()
    if (query) get().search(query)
  },

  loadMore: async () => {
    const { query, page, isSearching, sort, durationFilter } = get()
    if (isSearching || !query) return
    const nextPage = page + 1
    await withLoading(
      (v) => set({ isSearching: v }),
      async () => {
        const data = await window.api.freesound.search(query, nextPage, sort, DURATION_FILTER[durationFilter])
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
