import { ipcRenderer, contextBridge } from 'electron'
import type { Sample, Pack, Project, ProjectRegion, ExportRegionsParams } from '../types'

contextBridge.exposeInMainWorld('api', {
  library: {
    getSamples: (filters?: { bpm?: number; key?: string; tags?: string[] }): Promise<Sample[]> =>
      ipcRenderer.invoke('library:getSamples', filters),

    addSample: (data: { name: string; filePath: string; duration?: number }): Promise<Sample> =>
      ipcRenderer.invoke('library:addSample', data),

    updateSample: (
      id: string,
      data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>
    ): Promise<void> => ipcRenderer.invoke('library:updateSample', id, data),

    deleteSample: (id: string): Promise<void> =>
      ipcRenderer.invoke('library:deleteSample', id),
  },

  projects: {
    getAll: (): Promise<Project[]> =>
      ipcRenderer.invoke('projects:getAll'),

    get: (id: string): Promise<Project | null> =>
      ipcRenderer.invoke('projects:get', id),

    save: (data: { name: string; sourcePath: string | null; regions: ProjectRegion[] }): Promise<Project> =>
      ipcRenderer.invoke('projects:save', data),

    update: (id: string, data: Partial<Pick<Project, 'name' | 'regions'>>): Promise<void> =>
      ipcRenderer.invoke('projects:update', id, data),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('projects:delete', id),
  },

  audio: {
    exportRegions: (params: ExportRegionsParams): Promise<{ filesWritten: number }> =>
      ipcRenderer.invoke('audio:exportRegions', params),
  },

  fs: {
    pickFile: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:pickFile'),

    pickFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:pickFolder'),
  },

  packs: {
    getAll: (): Promise<Pack[]> =>
      ipcRenderer.invoke('packs:getAll'),

    getProfiles: (): Promise<Array<{ id: string; name: string; padCount: number }>> =>
      ipcRenderer.invoke('packs:getProfiles'),

    create: (data: Pick<Pack, 'name' | 'hardwareProfile'>): Promise<Pack> =>
      ipcRenderer.invoke('packs:create', data),

    upsertSlot: (packId: string, slotNumber: number, sampleId: string): Promise<void> =>
      ipcRenderer.invoke('packs:upsertSlot', packId, slotNumber, sampleId),

    removeSlot: (packId: string, slotNumber: number): Promise<void> =>
      ipcRenderer.invoke('packs:removeSlot', packId, slotNumber),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('packs:delete', id),

    export: (packId: string, outputDir: string): Promise<{ filesWritten: number }> =>
      ipcRenderer.invoke('packs:export', packId, outputDir),
  },
})
