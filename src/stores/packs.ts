import { create } from 'zustand'
import type { Pack, Sample } from '../../electron/types'

type PacksState = {
  packs: Pack[]
  currentPack: Pack | null
  slots: Record<number, Sample>
  hardwareProfileId: string
  exportProgress: number | null

  fetchPacks: () => Promise<void>
  createPack: (name: string, hardwareProfile: string) => Promise<Pack>
  setCurrentPack: (pack: Pack | null) => void
  setSlot: (slotNumber: number, sample: Sample) => void
  clearSlot: (slotNumber: number) => void
  setHardwareProfile: (profileId: string) => void
  exportPack: (outputDir: string) => Promise<{ filesWritten: number }>
  deletePack: (id: string) => Promise<void>
}

export const usePacksStore = create<PacksState>((set, get) => ({
  packs: [],
  currentPack: null,
  slots: {},
  hardwareProfileId: 'maschine-mk3',
  exportProgress: null,

  fetchPacks: async () => {
    const packs = await window.api.packs.getAll()
    set({ packs })
  },

  createPack: async (name, hardwareProfile) => {
    const pack = await window.api.packs.create({ name, hardwareProfile })
    set((state) => ({ packs: [pack, ...state.packs], currentPack: pack }))
    return pack
  },

  setCurrentPack: (currentPack) => set({ currentPack, slots: {} }),

  setSlot: async (slotNumber, sample) => {
    const { currentPack } = get()
    if (!currentPack) return

    await window.api.packs.upsertSlot(currentPack.id, slotNumber, sample.id)
    set((state) => ({ slots: { ...state.slots, [slotNumber]: sample } }))
  },

  clearSlot: async (slotNumber) => {
    const { currentPack } = get()
    if (!currentPack) return

    await window.api.packs.removeSlot(currentPack.id, slotNumber)
    set((state) => {
      const slots = { ...state.slots }
      delete slots[slotNumber]
      return { slots }
    })
  },

  setHardwareProfile: (hardwareProfileId) => set({ hardwareProfileId }),

  exportPack: async (outputDir) => {
    const { currentPack } = get()
    if (!currentPack) throw new Error('No pack selected')
    return window.api.packs.export(currentPack.id, outputDir)
  },

  deletePack: async (id) => {
    await window.api.packs.delete(id)
    set((state) => ({
      packs: state.packs.filter((p) => p.id !== id),
      currentPack: state.currentPack?.id === id ? null : state.currentPack,
    }))
  },
}))
