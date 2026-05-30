import type { Sample, Pack, PackSlot, Project, ProjectRegion, ProjectChop, PackSourceItem, ExportRegionsParams, FreesoundPage } from '../../electron/types'

declare global {
  interface Window {
    api: {
      library: {
        getSamples: (filters?: { bpm?: number; key?: string; tags?: string[]; projectId?: string }) => Promise<Sample[]>
        addSample: (data: { name: string; filePath: string; duration?: number }) => Promise<Sample>
        updateSample: (id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>) => Promise<void>
        deleteSample: (id: string) => Promise<void>
        saveChops: (params: {
          sourceFilePath: string
          regions: Array<{ start: number; end: number; name: string }>
          projectId?: string
        }) => Promise<Sample[]>
      }
      projects: {
        getAll: () => Promise<Project[]>
        get: (id: string) => Promise<Project | null>
        save: (data: { name: string; sourcePath: string | null; sourceName?: string | null; regions: ProjectRegion[] }) => Promise<Project>
        update: (id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => Promise<void>
        getChops: (projectId: string) => Promise<ProjectChop[]>
        getAllChops: () => Promise<Array<ProjectChop & { projectName: string; sourcePath: string | null }>>
        upsertChops: (projectId: string, regions: ProjectRegion[]) => Promise<ProjectChop[]>
        delete: (id: string) => Promise<void>
        duplicate: (id: string) => Promise<Project | null>
      }
      audio: {
        exportRegions: (params: ExportRegionsParams) => Promise<{ filesWritten: number }>
        trimSource: (params: { sourceFilePath: string; start: number; end: number }) => Promise<{ filePath: string; duration: number }>
      }
      fs: {
        getPathForFile: (file: File) => string
        pickFile: () => Promise<string | null>
        pickFolder: () => Promise<string | null>
      }
      settings: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
      }
      freesound: {
        search: (query: string, page?: number) => Promise<FreesoundPage>
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
        delete: (id: string) => Promise<void>
        rename: (id: string, name: string) => Promise<void>
        export: (packId: string, outputDir: string) => Promise<{ filesWritten: number }>
      }
    }
  }

}

export {}
