import { create } from 'zustand'
import { withLoading } from './utils'
import type { Project, ProjectRegion } from '@/types'

interface ProjectsState {
  projects: Project[]
  activeProject: Project | null
  isProjectDirty: boolean
  isLoading: boolean
  fetchProjects: () => Promise<void>
  setActiveProject: (project: Project | null) => void
  saveProject: (data: { name: string; sourcePath: string; sourceName?: string | null; regions: ProjectRegion[] }) => Promise<Project>
  updateActiveProject: () => Promise<void>
  updateActiveRegions: (regions: ProjectRegion[]) => Promise<void>
  autosaveActiveRegions: (regions: ProjectRegion[], fallback: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound' }) => Promise<Project | null>
  applyLocalTrim: (data: { sourcePath: string; regions: ProjectRegion[] }) => void
  renameProject: (id: string, name: string) => Promise<void>
  duplicateProject: (id: string) => Promise<Project | null>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProject: null,
  isProjectDirty: false,
  isLoading: false,

  fetchProjects: () => withLoading(
    (v) => set({ isLoading: v }),
    async () => {
      const projects = await window.api.projects.getAll()
      set({ projects })
    }
  ),

  setActiveProject: (project) => set({ activeProject: project, isProjectDirty: false }),

  saveProject: async (data) => {
    const saved = await window.api.projects.save(data)
    set((s) => ({ projects: [saved, ...s.projects], activeProject: saved, isProjectDirty: false }))
    return saved
  },

  applyLocalTrim: ({ sourcePath, regions }) => {
    const { activeProject } = get()
    if (!activeProject) return
    const updated = { ...activeProject, sourcePath, regions }
    set((s) => ({
      activeProject: updated,
      isProjectDirty: true,
      projects: s.projects.map((p) => (p.id === activeProject.id ? updated : p)),
    }))
  },

  updateActiveProject: async () => {
    const { activeProject } = get()
    if (!activeProject) return
    await window.api.projects.update(activeProject.id, {
      sourcePath: activeProject.sourcePath,
      regions: activeProject.regions,
    })
    set({ isProjectDirty: false })
  },

  updateActiveRegions: async (regions) => {
    const { activeProject } = get()
    if (!activeProject) return
    await window.api.projects.update(activeProject.id, { regions })
    set((s) => ({
      activeProject: s.activeProject ? { ...s.activeProject, regions } : null,
      projects: s.projects.map((p) => (p.id === activeProject.id ? { ...p, regions } : p)),
    }))
  },

  autosaveActiveRegions: async (regions, fallback) => {
    let { activeProject } = get()
    if (!activeProject) {
      if (!fallback.sourcePath) return null
      activeProject = await window.api.projects.save({
        name: fallback.name.trim() || 'Untitled Project',
        sourcePath: fallback.sourcePath,
        sourceName: fallback.sourceName ?? null,
        source: fallback.source ?? 'local',
        regions,
      })
      set((s) => ({
        projects: [activeProject!, ...s.projects],
        activeProject,
        isProjectDirty: false,
      }))
      return activeProject
    }

    const saved = await window.api.projects.upsertChops(activeProject.id, regions)
    const updated = {
      ...activeProject,
      sourcePath: fallback.sourcePath ?? activeProject.sourcePath,
      regions: saved,
    }
    if (fallback.sourcePath !== undefined && fallback.sourcePath !== activeProject.sourcePath) {
      await window.api.projects.update(activeProject.id, { sourcePath: fallback.sourcePath, regions: saved })
    }
    set((s) => ({
      activeProject: updated,
      isProjectDirty: false,
      projects: s.projects.map((p) => (p.id === activeProject.id ? updated : p)),
    }))
    return updated
  },

  renameProject: async (id, name) => {
    await window.api.projects.update(id, { name })
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
      activeProject: s.activeProject?.id === id ? { ...s.activeProject, name } : s.activeProject,
    }))
  },

  duplicateProject: async (id) => {
    const copy = await window.api.projects.duplicate(id)
    if (copy) set((s) => ({ projects: [copy, ...s.projects] }))
    return copy
  },

  deleteProject: async (id) => {
    await window.api.projects.delete(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
      isProjectDirty: s.activeProject?.id === id ? false : s.isProjectDirty,
    }))
  },
}))
