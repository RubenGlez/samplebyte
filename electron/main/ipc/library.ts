import { ipcMain, app } from 'electron'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'node:path'
import fs from 'node:fs'
import * as samples from '../db/queries/samples'
import * as projects from '../db/queries/projects'
import type { Sample, Project, ProjectRegion } from '../../types'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

function trimToWav(input: string, output: string, start: number, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(duration)
      .toFormat('wav')
      .audioFrequency(44100)
      .audioChannels(2)
      .outputOptions(['-sample_fmt s16'])
      .output(output)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

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
    samples.deleteSample(id)
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

      const sample = samples.addSample({
        name: region.name || `Sample ${index + 1}`,
        filePath: outputPath,
        duration: region.end - region.start,
        source: 'local',
        projectId: params.projectId ?? null,
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

  ipcMain.handle('projects:save', (_, data: { name: string; sourcePath: string | null; regions: ProjectRegion[] }) => {
    return projects.saveProject(data)
  })

  ipcMain.handle('projects:update', (_, id: string, data: Partial<Pick<Project, 'name' | 'regions'>>) => {
    projects.updateProject(id, data)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    projects.deleteProject(id)
  })
}
