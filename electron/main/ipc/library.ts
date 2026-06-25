import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import * as samples from '../db/queries/samples'

const AUDIO_EXTS = new Set(['wav', 'mp3', 'flac', 'aiff', 'aif', 'ogg', 'm4a'])

function scanAudioFiles(dir: string): string[] {
  let found: string[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return found }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found = found.concat(scanAudioFiles(full))
    } else if (entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).slice(1).toLowerCase())) {
      found.push(full)
    }
  }
  return found
}
import * as projects from '../db/queries/projects'
import { trimToWav } from '../services/trim'
import { extractWaveformData } from '../audio/waveform'
import { syncProjectChopsToLibrary } from '../services/materializeChops'
import type { Sample, Project, ProjectRegion } from '../../types'

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:getSamples', (_, filters?: { bpm?: number; key?: string; tags?: string[]; projectId?: string }) => {
    return samples.getAllSamples(filters)
  })

  ipcMain.handle('library:addSample', (_, data: { name: string; filePath: string; duration?: number }) => {
    return samples.addSample(data)
  })

  ipcMain.handle('library:updateSample', (_, id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>) => {
    samples.updateSample(id, data)
  })

  ipcMain.handle('library:importFolder', (_, folderPath: string) => {
    const existing = new Set(samples.getAllSamples().map((s) => s.filePath))
    const allFiles = scanAudioFiles(folderPath)
    const newFiles = allFiles.filter((f) => !existing.has(f))
    for (const filePath of newFiles) {
      const name = path.basename(filePath, path.extname(filePath))
      samples.addSample({ name, filePath, source: 'local' })
    }
    return { imported: newFiles.length, skipped: allFiles.length - newFiles.length }
  })

  ipcMain.handle('library:deleteSample', (_, id: string) => {
    const filePath = samples.deleteSample(id)
    if (filePath) {
      try { fs.unlinkSync(filePath) } catch { /* file already gone, ignore */ }
    }
  })

  ipcMain.handle('library:saveChops', async (_, params: {
    sourceFilePath: string
    regions: Array<{ start: number; end: number; name: string }>
    projectId?: string
  }) => {
    const samplesDir = path.join(app.getPath('userData'), 'samples')
    if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true })

    const saved: Sample[] = []

    for (const [index, region] of params.regions.entries()) {
      const id = crypto.randomUUID()
      const outputPath = path.join(samplesDir, `${id}.wav`)

      await trimToWav(params.sourceFilePath, outputPath, region.start, region.end - region.start)

      const waveformData = extractWaveformData(outputPath)

      const sample = samples.addSample({
        name: region.name || `Sample ${index + 1}`,
        filePath: outputPath,
        duration: region.end - region.start,
        source: 'local',
        projectId: params.projectId ?? null,
        waveformData,
      })

      saved.push(sample)
    }

    return saved
  })

  ipcMain.handle('projects:getAll', () => {
    return projects.getAllProjects()
  })

  ipcMain.handle('projects:get', (_, id: string) => {
    return projects.getProject(id)
  })

  ipcMain.handle('projects:save', async (_, data: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; regions: ProjectRegion[] }) => {
    const project = projects.saveProject(data)
    await syncProjectChopsToLibrary(project.id)
    return project
  })

  ipcMain.handle('projects:update', async (_, id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => {
    projects.updateProject(id, data)
    if (data.regions !== undefined) await syncProjectChopsToLibrary(id)
  })

  ipcMain.handle('projects:getChops', (_, projectId: string) => {
    return projects.getProjectChops(projectId)
  })

  ipcMain.handle('projects:getAllChops', () => {
    return projects.getAllProjectChops()
  })

  ipcMain.handle('projects:upsertChops', async (_, projectId: string, regions: ProjectRegion[]) => {
    const chops = projects.upsertProjectChops(projectId, regions)
    await syncProjectChopsToLibrary(projectId)
    return chops
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
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

  ipcMain.handle('projects:duplicate', async (_, id: string) => {
    const project = projects.duplicateProject(id)
    if (project) await syncProjectChopsToLibrary(project.id)
    return project
  })

  ipcMain.handle('library:getPackSlotRefCount', (_, id: string) => {
    return samples.getSamplePackSlotRefCount(id)
  })

  ipcMain.handle('library:getOrphans', () => {
    return samples.getAllSamples().filter((s) => !fs.existsSync(s.filePath))
  })

  ipcMain.handle('library:deleteOrphans', (_, ids: string[]) => {
    for (const id of ids) samples.deleteSample(id)
    return { deleted: ids.length }
  })
}
