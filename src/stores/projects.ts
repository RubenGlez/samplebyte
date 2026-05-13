import { create } from 'zustand'
import type { Project } from '@/types'

interface ProjectsState {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  fetchProjects: () => Promise<void>
  setActiveProject: (project: Project | null) => void
  saveProject: (data: { name: string; sourcePath: string; regions: Project['regions'] }) => Promise<Project>
  updateActiveRegions: (regions: Project['regions']) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProject: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await window.api.projects.getAll()
      set({ projects })
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveProject: (project) => set({ activeProject: project }),

  saveProject: async (data) => {
    const saved = await window.api.projects.save(data)
    set((s) => ({ projects: [saved, ...s.projects], activeProject: saved }))
    return saved
  },

  updateActiveRegions: async (regions) => {
    const { activeProject } = get()
    if (!activeProject) return
    await window.api.projects.update(activeProject.id, { regions })
    set((s) => ({
      activeProject: s.activeProject ? { ...s.activeProject, regions } : null,
      projects: s.projects.map((p) => p.id === activeProject.id ? { ...p, regions } : p),
    }))
  },

  deleteProject: async (id) => {
    await window.api.projects.delete(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }))
  },
}))
