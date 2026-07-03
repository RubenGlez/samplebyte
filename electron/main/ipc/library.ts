import path from 'node:path'
import fs from 'node:fs'
import { handle } from './handle'
import * as samples from '../db/queries/samples'

const AUDIO_EXTS = new Set(['wav', 'mp3', 'flac', 'aiff', 'aif', 'ogg', 'm4a'])

// Async recursive scan so importing a large/NAS folder doesn't block the event loop (and every
// window + all IPC) the way the old synchronous walk did (F16).
async function scanAudioFiles(dir: string): Promise<string[]> {
  let entries: fs.Dirent[]
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const found: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...await scanAudioFiles(full))
    } else if (entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).slice(1).toLowerCase())) {
      found.push(full)
    }
  }
  return found
}
import * as projects from '../db/queries/projects'
import { syncProjectChopsToLibrary } from '../services/materializeChops'
import type { Sample, Project, ProjectRegion } from '../../types'

export function registerLibraryHandlers(): void {
  handle('library:getSamples', (_, filters?: { bpm?: number; key?: string; tags?: string[]; projectId?: string }) => {
    return samples.getAllSamples(filters)
  })

  handle('library:addSample', (_, data: { name: string; filePath: string; duration?: number }) => {
    return samples.addSample(data)
  })

  handle('library:updateSample', (_, id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>) => {
    samples.updateSample(id, data)
  })

  handle('library:importFolder', async (_, folderPath: string) => {
    const allFiles = await scanAudioFiles(folderPath)
    // Dedup + insert happen in one transaction; INSERT OR IGNORE drops paths already in the library.
    const candidates = allFiles.map((filePath) => ({ name: path.basename(filePath, path.extname(filePath)), filePath }))
    const imported = samples.importLocalFiles(candidates)
    return { imported, skipped: allFiles.length - imported }
  })

  handle('library:deleteSample', (_, id: string) => {
    const filePath = samples.deleteSample(id)
    if (filePath) {
      try { fs.unlinkSync(filePath) } catch { /* file already gone, ignore */ }
    }
  })

  handle('projects:getAll', () => {
    return projects.getAllProjects()
  })

  handle('projects:get', (_, id: string) => {
    return projects.getProject(id)
  })

  handle('projects:save', async (_, data: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; freesoundId?: string | null; license?: string | null; author?: string | null; regions: ProjectRegion[] }) => {
    const project = projects.saveProject(data)
    await syncProjectChopsToLibrary(project.id)
    return project
  })

  handle('projects:update', async (_, id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => {
    projects.updateProject(id, data)
    if (data.regions !== undefined) await syncProjectChopsToLibrary(id)
  })

  handle('projects:getChops', (_, projectId: string) => {
    return projects.getProjectChops(projectId)
  })

  handle('projects:getAllChops', () => {
    return projects.getAllProjectChops()
  })

  handle('projects:upsertChops', async (_, projectId: string, regions: ProjectRegion[]) => {
    const chops = projects.upsertProjectChops(projectId, regions)
    await syncProjectChopsToLibrary(projectId)
    return chops
  })

  handle('projects:delete', (_, id: string) => {
    // The library is a projection of projects, so a deleted project's materialized chops leave the
    // library too (rows + files). Pack slots that referenced them are left intact — packs are
    // independent snapshots.
    for (const sample of samples.getAllSamples({ projectId: id })) {
      if (sample.source !== 'chop') continue
      const filePath = samples.deleteChopSampleRow(sample.id)
      if (filePath) {
        try { fs.unlinkSync(filePath) } catch { /* already gone */ }
      }
    }
    projects.deleteProject(id)
  })

  handle('projects:duplicate', async (_, id: string) => {
    const project = projects.duplicateProject(id)
    if (project) await syncProjectChopsToLibrary(project.id)
    return project
  })

  handle('library:getPackSlotRefCount', (_, id: string) => {
    return samples.getSamplePackSlotRefCount(id)
  })

  handle('library:getOrphans', () => {
    return samples.getAllSamples().filter((s) => !fs.existsSync(s.filePath))
  })

  handle('library:deleteOrphans', (_, ids: string[]) => {
    for (const id of ids) samples.deleteSample(id)
    return { deleted: ids.length }
  })
}
