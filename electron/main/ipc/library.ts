import { ipcMain } from 'electron'
import * as samples from '../db/queries/samples'
import * as projects from '../db/queries/projects'
import type { Sample, Project, ProjectRegion } from '../../types'

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:getSamples', (_, filters?: { bpm?: number; key?: string; tags?: string[] }) => {
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
