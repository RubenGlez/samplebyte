import { create } from 'zustand'

type View = 'chop' | 'library' | 'packs'

type UiState = {
  currentView: View
  sidebarOpen: boolean
  pendingFocusStart: number | null
  setView: (view: View) => void
  toggleSidebar: () => void
  setPendingFocusStart: (start: number | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chop',
  sidebarOpen: true,
  pendingFocusStart: null,
  setView: (currentView) => set({ currentView }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPendingFocusStart: (pendingFocusStart) => set({ pendingFocusStart }),
}))
