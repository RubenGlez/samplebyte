import { create } from 'zustand'

type View = 'chop' | 'library' | 'packs'

// How a pad previews in the Pack screen. Gate plays while held and stops on release; One-Shot ignores
// release and plays the chop through to its end. Audition-only: session-only, never persisted or exported.
export type PadAuditionMode = 'gate' | 'oneshot'

type UiState = {
  currentView: View
  sidebarOpen: boolean
  pendingFocusStart: number | null
  padAuditionMode: PadAuditionMode
  setView: (view: View) => void
  toggleSidebar: () => void
  setPendingFocusStart: (start: number | null) => void
  setPadAuditionMode: (mode: PadAuditionMode) => void
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chop',
  sidebarOpen: true,
  pendingFocusStart: null,
  padAuditionMode: 'gate',
  setView: (currentView) => set({ currentView }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPendingFocusStart: (pendingFocusStart) => set({ pendingFocusStart }),
  setPadAuditionMode: (padAuditionMode) => set({ padAuditionMode }),
}))
