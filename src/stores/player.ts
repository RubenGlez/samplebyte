import { create } from 'zustand'

type AudioSource = {
  name: string
  path: string
  size: number
  type: string
}

type PlayerState = {
  audio: AudioSource | null
  setAudio: (audio: AudioSource) => void
  clearAudio: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  audio: null,

  setAudio: (audio) => set({ audio }),

  clearAudio: () => set({ audio: null }),
}))
