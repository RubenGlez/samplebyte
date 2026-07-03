// Single source of truth for the renderer<->main bridge. The grouped `Api` shape is what the
// renderer sees as `window.api`; the preload bridge is typed against it (so it can't forward the
// wrong args), `Window.api` is declared from it, and main handlers are registered through the
// typed `handle` helper keyed by the flattened channel map below. Change a signature here and all
// three faces fail to compile until they agree.
import type {
  Sample,
  Pack,
  PackSlot,
  Project,
  ProjectRegion,
  ProjectChop,
  PackSourceItem,
  FreesoundPage,
  StemPcm,
  StemFile,
} from './types'

export type Api = {
  library: {
    getSamples: (filters?: { bpm?: number; key?: string; tags?: string[]; projectId?: string }) => Promise<Sample[]>
    addSample: (data: { name: string; filePath: string; duration?: number }) => Promise<Sample>
    updateSample: (id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>) => Promise<void>
    deleteSample: (id: string) => Promise<void>
    importFolder: (folderPath: string) => Promise<{ imported: number; skipped: number }>
    getPackSlotRefCount: (id: string) => Promise<number>
    getOrphans: () => Promise<Sample[]>
    deleteOrphans: (ids: string[]) => Promise<{ deleted: number }>
  }
  projects: {
    getAll: () => Promise<Project[]>
    get: (id: string) => Promise<Project | null>
    save: (data: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; freesoundId?: string | null; license?: string | null; author?: string | null; regions: ProjectRegion[] }) => Promise<Project>
    update: (id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => Promise<void>
    getChops: (projectId: string) => Promise<ProjectChop[]>
    getAllChops: () => Promise<Array<ProjectChop & { projectName: string; sourcePath: string | null; source: 'local' | 'freesound' }>>
    upsertChops: (projectId: string, regions: ProjectRegion[]) => Promise<ProjectChop[]>
    delete: (id: string) => Promise<void>
    duplicate: (id: string) => Promise<Project | null>
  }
  audio: {
    trimSource: (params: { sourceFilePath: string; start: number; end: number }) => Promise<{ filePath: string; duration: number }>
  }
  stems: {
    // Read a vendored model artifact (demucs.js/.wasm/.data) as bytes for the worker.
    getModelFile: (name: string) => Promise<Uint8Array>
    // Return the cached stem set for a source hash if all stems are present on disk, else null.
    getCached: (sourceHash: string) => Promise<StemFile[] | null>
    // Normalize and write the separated stems under userData/stems/<sourceHash>/.
    persist: (sourceHash: string, stems: StemPcm[]) => Promise<StemFile[]>
  }
  fs: {
    getPathForFile: (file: File) => string
    // Broker a renderer-obtained path (drag-drop) so local-file:// will serve it. See F32.
    allowPath: (filePath: string) => Promise<void>
    pickFile: () => Promise<string | null>
    pickFolder: () => Promise<string | null>
  }
  settings: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }
  freesound: {
    search: (query: string, page?: number, sort?: string, filter?: string) => Promise<FreesoundPage>
    download: (soundId: number, name: string, previewUrl: string) => Promise<{ name: string; filePath: string }>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  packs: {
    getAll: () => Promise<Pack[]>
    getSlots: (packId: string) => Promise<PackSlot[]>
    getProfiles: () => Promise<Array<{ id: string; name: string; padCount: number }>>
    create: (data: Pick<Pack, 'name' | 'hardwareProfile'>) => Promise<Pack>
    upsertSlot: (packId: string, slotNumber: number, source: PackSourceItem) => Promise<void>
    removeSlot: (packId: string, slotNumber: number) => Promise<void>
    rename: (id: string, name: string) => Promise<void>
    delete: (id: string) => Promise<void>
    export: (packId: string, outputDir: string) => Promise<{ filesWritten: number; failed: number }>
    // Rebuild an orphaned chop pad's audio back into the library (from the pad's owned WAV) and
    // relink the pad to the new sample. Returns the created sample.
    regenerateSlotToLibrary: (packId: string, slotNumber: number) => Promise<Sample>
  }
  updates: {
    check: () => Promise<UpdateCheckResult>
    download: () => Promise<void>
    install: () => Promise<void>
  }
}

// Result of an update check. `available` is false in dev (nothing to update); `error` carries a
// network/check failure message.
export type UpdateCheckResult =
  | { available: boolean; version: string; newVersion?: string }
  | { error: string }

// Main -> renderer push events. Kept separate from the invoke groups above so it stays out of the
// ApiChannels flattening (these are ipcRenderer.on subscriptions, not invoke handlers). Each method
// registers a listener and returns an unsubscribe function.
export type ApiEvents = {
  // Fired after a background startup task (chop backfill) changes the library so the UI can refetch.
  onLibraryChanged: (cb: () => void) => () => void
  // Auto-update lifecycle (F18): a newer version is available, download progress (0..100), the
  // download finished (ready to install), or the updater errored.
  onUpdateAvailable: (cb: (info: { version: string; newVersion?: string }) => void) => () => void
  onUpdateProgress: (cb: (percent: number) => void) => () => void
  onUpdateDownloaded: (cb: () => void) => () => void
  onUpdateError: (cb: (message: string) => void) => () => void
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// Flatten the grouped Api into the flat `group:method` channel names used over IPC, preserving
// each method's exact signature. This is what main-side `handle` is keyed by.
export type ApiChannels = UnionToIntersection<
  {
    [G in keyof Api]: {
      [M in keyof Api[G] as `${G & string}:${M & string}`]: Api[G][M]
    }
  }[keyof Api]
>
