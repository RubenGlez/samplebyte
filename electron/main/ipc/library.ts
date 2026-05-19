import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import * as samples from '../db/queries/samples'
import * as projects from '../db/queries/projects'
import { trimToWav } from '../services/trim'
import type { Sample, Project, ProjectRegion } from '../../types'

// Reads a s16 stereo WAV (as produced by trimToWav) and returns ~100 peak amplitude values.
function extractWaveformData(filePath: string, bars = 100): number[] {
  const buf = fs.readFileSync(filePath)

  // Walk chunks to find 'data'
  let offset = 12
  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    if (chunkId === 'data') { offset += 8; break }
    offset += 8 + chunkSize
  }

  const bytesPerFrame = 4 // s16 stereo
  const totalFrames = Math.floor((buf.length - offset) / bytesPerFrame)
  const framesPerBar = Math.max(1, Math.floor(totalFrames / bars))
  const result: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const start = offset + i * framesPerBar * bytesPerFrame
    const end = Math.min(start + framesPerBar * bytesPerFrame, buf.length - 1)
    for (let j = start; j < end; j += 2) {
      const v = Math.abs(buf.readInt16LE(j)) / 32767
      if (v > peak) peak = v
    }
    result.push(peak)
  }

  return result
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

  ipcMain.handle('projects:save', (_, data: { name: string; sourcePath: string | null; regions: ProjectRegion[] }) => {
    return projects.saveProject(data)
  })

  ipcMain.handle('projects:update', (_, id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>) => {
    projects.updateProject(id, data)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    projects.deleteProject(id)
  })

  ipcMain.handle('projects:duplicate', (_, id: string) => {
    return projects.duplicateProject(id)
  })
}
