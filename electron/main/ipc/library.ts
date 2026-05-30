import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import * as samples from '../db/queries/samples'
import * as projects from '../db/queries/projects'
import { trimToWav } from '../services/trim'
import { extractWaveformData } from '../audio/waveform'
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

  ipcMain.handle('projects:save', (_, data: { name: string; sourcePath: string | null; sourceName?: string | null; regions: ProjectRegion[] }) => {
    return projects.saveProject(data)
  })

  ipcMain.handle('projects:update', (_, id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => {
    projects.updateProject(id, data)
  })

  ipcMain.handle('projects:getChops', (_, projectId: string) => {
    return projects.getProjectChops(projectId)
  })

  ipcMain.handle('projects:getAllChops', () => {
    return projects.getAllProjectChops()
  })

  ipcMain.handle('projects:upsertChops', (_, projectId: string, regions: ProjectRegion[]) => {
    return projects.upsertProjectChops(projectId, regions)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    projects.deleteProject(id)
  })

  ipcMain.handle('projects:duplicate', (_, id: string) => {
    return projects.duplicateProject(id)
  })
}
