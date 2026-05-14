import { create } from 'zustand'

type View = 'chop' | 'library' | 'packs'

type UiState = {
  currentView: View
  sidebarOpen: boolean
  setView: (view: View) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chop',
  sidebarOpen: true,
  setView: (currentView) => set({ currentView }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
