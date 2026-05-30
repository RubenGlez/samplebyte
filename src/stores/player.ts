import { create } from 'zustand'
import type { ProjectRegion } from '@/types'

export type AudioSource = {
  name: string
  path: string      // blob URL or file:// URL — used by WaveSurfer
  filePath: string  // native FS path — used by ffmpeg
  size: number
  type: string
  source: 'local' | 'freesound'
  /** Regions to restore on the next waveform mount (e.g. after trim). */
  initialRegions?: ProjectRegion[]
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
