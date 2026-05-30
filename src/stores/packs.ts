import { create } from 'zustand'
import type { Pack, PackSlot, PackSourceItem } from '../../electron/types'

type PacksState = {
  packs: Pack[]
  currentPack: Pack | null
  slots: Record<number, PackSlot>
  hardwareProfileId: string
  exportProgress: number | null

  fetchPacks: () => Promise<void>
  createPack: (name: string, hardwareProfile: string) => Promise<Pack>
  renamePack: (id: string, name: string) => Promise<void>
  setCurrentPack: (pack: Pack | null) => void
  loadSlots: () => Promise<void>
  initSlots: (slots: Record<number, PackSlot>) => void
  setSlot: (slotNumber: number, source: PackSourceItem) => Promise<void>
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

  renamePack: async (id, name) => {
    await window.api.packs.rename(id, name)
    set((s) => ({
      packs: s.packs.map((p) => (p.id === id ? { ...p, name } : p)),
      currentPack: s.currentPack?.id === id ? { ...s.currentPack, name } : s.currentPack,
    }))
  },

  setCurrentPack: (currentPack) => set({ currentPack, slots: {} }),
  loadSlots: async () => {
    const { currentPack } = get()
    if (!currentPack) return
    const packSlots = await window.api.packs.getSlots(currentPack.id)
    set({ slots: Object.fromEntries(packSlots.map((slot) => [slot.slotNumber, slot])) })
  },
  initSlots: (slots) => set({ slots }),

  setSlot: async (slotNumber, source) => {
    const { currentPack } = get()
    if (!currentPack) return

    await window.api.packs.upsertSlot(currentPack.id, slotNumber, source)
    const slot: PackSlot = {
      packId: currentPack.id,
      slotNumber,
      sourceType: source.sourceType,
      sourcePath: source.sourcePath,
      projectId: source.projectId,
      projectChopId: source.projectChopId,
      sampleId: source.sampleId,
      start: source.start,
      end: source.end,
      displayName: source.displayName,
      sourceChopUpdatedAt: source.sourceChopUpdatedAt,
      pitchShiftSemitones: null,
      timeStretchRatio: null,
    }
    set((state) => ({ slots: { ...state.slots, [slotNumber]: slot } }))
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
