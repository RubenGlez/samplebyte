import type { Sample, Pack, Project, ProjectRegion, ExportRegionsParams } from '../../electron/types'

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
        save: (data: { name: string; sourcePath: string | null; regions: ProjectRegion[] }) => Promise<Project>
        update: (id: string, data: Partial<Pick<Project, 'name' | 'regions'>>) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      audio: {
        exportRegions: (params: ExportRegionsParams) => Promise<{ filesWritten: number }>
      }
      fs: {
        pickFile: () => Promise<string | null>
        pickFolder: () => Promise<string | null>
      }
      packs: {
        getAll: () => Promise<Pack[]>
        getProfiles: () => Promise<Array<{ id: string; name: string; padCount: number }>>
        create: (data: Pick<Pack, 'name' | 'hardwareProfile'>) => Promise<Pack>
        upsertSlot: (packId: string, slotNumber: number, sampleId: string) => Promise<void>
        removeSlot: (packId: string, slotNumber: number) => Promise<void>
        delete: (id: string) => Promise<void>
        export: (packId: string, outputDir: string) => Promise<{ filesWritten: number }>
      }
    }
  }

  // Electron adds .path to File objects from drag-and-drop
  interface File {
    path: string
  }
}

export {}
