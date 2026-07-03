import { ipcRenderer, contextBridge, webUtils } from 'electron'
import type { Api, ApiEvents } from '../ipc-contract'

// Subscribe to a main->renderer channel, returning an unsubscribe. Args are forwarded straight to
// the callback; the sender event object is stripped so the renderer never touches ipc internals.
function subscribe(channel: string, cb: (...args: unknown[]) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Typed against the shared contract: each method just forwards to its `group:method` channel, and
// the contract guarantees the args/return match what main registers. Drift is a compile error.
const api: Api & { events: ApiEvents } = {
  library: {
    getSamples: (filters) => ipcRenderer.invoke('library:getSamples', filters),
    addSample: (data) => ipcRenderer.invoke('library:addSample', data),
    updateSample: (id, data) => ipcRenderer.invoke('library:updateSample', id, data),
    deleteSample: (id) => ipcRenderer.invoke('library:deleteSample', id),
    importFolder: (folderPath) => ipcRenderer.invoke('library:importFolder', folderPath),
    getPackSlotRefCount: (id) => ipcRenderer.invoke('library:getPackSlotRefCount', id),
    getOrphans: () => ipcRenderer.invoke('library:getOrphans'),
    deleteOrphans: (ids) => ipcRenderer.invoke('library:deleteOrphans', ids),
  },

  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    get: (id) => ipcRenderer.invoke('projects:get', id),
    save: (data) => ipcRenderer.invoke('projects:save', data),
    update: (id, data) => ipcRenderer.invoke('projects:update', id, data),
    getChops: (projectId) => ipcRenderer.invoke('projects:getChops', projectId),
    getAllChops: () => ipcRenderer.invoke('projects:getAllChops'),
    upsertChops: (projectId, regions) => ipcRenderer.invoke('projects:upsertChops', projectId, regions),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
    duplicate: (id) => ipcRenderer.invoke('projects:duplicate', id),
  },

  audio: {
    trimSource: (params) => ipcRenderer.invoke('audio:trimSource', params),
  },

  stems: {
    getModelFile: (name) => ipcRenderer.invoke('stems:getModelFile', name),
    getCached: (sourceHash) => ipcRenderer.invoke('stems:getCached', sourceHash),
    persist: (sourceHash, stems) => ipcRenderer.invoke('stems:persist', sourceHash, stems),
  },

  fs: {
    getPathForFile: (file) => webUtils.getPathForFile(file),
    allowPath: (filePath) => ipcRenderer.invoke('fs:allowPath', filePath),
    pickFile: () => ipcRenderer.invoke('fs:pickFile'),
    pickFolder: () => ipcRenderer.invoke('fs:pickFolder'),
  },

  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },

  freesound: {
    search: (query, page, sort, filter) => ipcRenderer.invoke('freesound:search', query, page, sort, filter),
    download: (soundId, name, previewUrl) => ipcRenderer.invoke('freesound:download', soundId, name, previewUrl),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },

  packs: {
    getAll: () => ipcRenderer.invoke('packs:getAll'),
    getSlots: (packId) => ipcRenderer.invoke('packs:getSlots', packId),
    getProfiles: () => ipcRenderer.invoke('packs:getProfiles'),
    create: (data) => ipcRenderer.invoke('packs:create', data),
    upsertSlot: (packId, slotNumber, source) => ipcRenderer.invoke('packs:upsertSlot', packId, slotNumber, source),
    removeSlot: (packId, slotNumber) => ipcRenderer.invoke('packs:removeSlot', packId, slotNumber),
    rename: (id, name) => ipcRenderer.invoke('packs:rename', id, name),
    delete: (id) => ipcRenderer.invoke('packs:delete', id),
    export: (packId, outputDir) => ipcRenderer.invoke('packs:export', packId, outputDir),
    regenerateSlotToLibrary: (packId, slotNumber) => ipcRenderer.invoke('packs:regenerateSlotToLibrary', packId, slotNumber),
  },

  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
  },

  events: {
    onLibraryChanged: (cb) => subscribe('library:changed', () => cb()),
    onUpdateAvailable: (cb) => subscribe('update:available', (info) => cb(info as { version: string; newVersion?: string })),
    onUpdateProgress: (cb) => subscribe('update:progress', (percent) => cb(percent as number)),
    onUpdateDownloaded: (cb) => subscribe('update:downloaded', () => cb()),
    onUpdateError: (cb) => subscribe('update:error', (message) => cb(message as string)),
  },
}

contextBridge.exposeInMainWorld('api', api)
