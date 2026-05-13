import { create } from 'zustand'

type View = 'chop' | 'library' | 'packs'

type UiState = {
  currentView: View
  setView: (view: View) => void
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chop',
  setView: (currentView) => set({ currentView }),
}))
