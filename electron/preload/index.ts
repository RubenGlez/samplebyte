import { ipcRenderer, contextBridge, webUtils } from 'electron'
import type { Sample, Pack, PackSlot, Project, ProjectRegion, ProjectChop, PackSourceItem, ExportRegionsParams, FreesoundPage } from '../types'

contextBridge.exposeInMainWorld('api', {
  library: {
    getSamples: (filters?: { bpm?: number; key?: string; tags?: string[]; projectId?: string }): Promise<Sample[]> =>
      ipcRenderer.invoke('library:getSamples', filters),

    addSample: (data: { name: string; filePath: string; duration?: number }): Promise<Sample> =>
      ipcRenderer.invoke('library:addSample', data),

    updateSample: (
      id: string,
      data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>
    ): Promise<void> => ipcRenderer.invoke('library:updateSample', id, data),

    deleteSample: (id: string): Promise<void> =>
      ipcRenderer.invoke('library:deleteSample', id),

    saveChops: (params: {
      sourceFilePath: string
      regions: Array<{ start: number; end: number; name: string }>
      projectId?: string
    }): Promise<Sample[]> => ipcRenderer.invoke('library:saveChops', params),
  },

  projects: {
    getAll: (): Promise<Project[]> =>
      ipcRenderer.invoke('projects:getAll'),

    get: (id: string): Promise<Project | null> =>
      ipcRenderer.invoke('projects:get', id),

    save: (data: { name: string; sourcePath: string | null; sourceName?: string | null; regions: ProjectRegion[] }): Promise<Project> =>
      ipcRenderer.invoke('projects:save', data),

    update: (id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>): Promise<void> =>
      ipcRenderer.invoke('projects:update', id, data),

    getChops: (projectId: string): Promise<ProjectChop[]> =>
      ipcRenderer.invoke('projects:getChops', projectId),

    getAllChops: (): Promise<Array<ProjectChop & { projectName: string; sourcePath: string | null }>> =>
      ipcRenderer.invoke('projects:getAllChops'),

    upsertChops: (projectId: string, regions: ProjectRegion[]): Promise<ProjectChop[]> =>
      ipcRenderer.invoke('projects:upsertChops', projectId, regions),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('projects:delete', id),

    duplicate: (id: string): Promise<Project | null> =>
      ipcRenderer.invoke('projects:duplicate', id),
  },

  audio: {
    exportRegions: (params: ExportRegionsParams): Promise<{ filesWritten: number }> =>
      ipcRenderer.invoke('audio:exportRegions', params),
    trimSource: (params: { sourceFilePath: string; start: number; end: number }): Promise<{ filePath: string; duration: number }> =>
      ipcRenderer.invoke('audio:trimSource', params),
  },

  fs: {
    getPathForFile: (file: File): string =>
      webUtils.getPathForFile(file),

    pickFile: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:pickFile'),

    pickFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:pickFolder'),
  },

  settings: {
    get: (key: string): Promise<unknown> =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
  },

  freesound: {
    search: (query: string, page?: number, sort?: string, filter?: string): Promise<FreesoundPage> =>
      ipcRenderer.invoke('freesound:search', query, page, sort, filter),
    download: (soundId: number, name: string, previewUrl: string): Promise<{ name: string; filePath: string }> =>
      ipcRenderer.invoke('freesound:download', soundId, name, previewUrl),
  },

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:openExternal', url),
  },

  packs: {
    getAll: (): Promise<Pack[]> =>
      ipcRenderer.invoke('packs:getAll'),

    getSlots: (packId: string): Promise<PackSlot[]> =>
      ipcRenderer.invoke('packs:getSlots', packId),

    getProfiles: (): Promise<Array<{ id: string; name: string; padCount: number }>> =>
      ipcRenderer.invoke('packs:getProfiles'),

    create: (data: Pick<Pack, 'name' | 'hardwareProfile'>): Promise<Pack> =>
      ipcRenderer.invoke('packs:create', data),

    upsertSlot: (packId: string, slotNumber: number, source: PackSourceItem): Promise<void> =>
      ipcRenderer.invoke('packs:upsertSlot', packId, slotNumber, source),

    removeSlot: (packId: string, slotNumber: number): Promise<void> =>
      ipcRenderer.invoke('packs:removeSlot', packId, slotNumber),

    rename: (id: string, name: string): Promise<void> =>
      ipcRenderer.invoke('packs:rename', id, name),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('packs:delete', id),

    export: (packId: string, outputDir: string): Promise<{ filesWritten: number }> =>
      ipcRenderer.invoke('packs:export', packId, outputDir),
  },
})
