import { useEffect } from 'react'
import { Trash2, FolderOpen } from 'lucide-react'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import Loader from '@/components/Loader'
import Editor from '@/components/Editor'
import type { Project } from '@/types'

export default function ChopView() {
  const { audio, setAudio } = usePlayerStore()
  const { projects, isLoading, fetchProjects, setActiveProject, deleteProject } = useProjectsStore()
  const { toast } = useToastStore()

  useEffect(() => {
    if (!audio) fetchProjects()
  }, [audio, fetchProjects])

  const loadProject = (project: Project) => {
    if (!project.sourcePath) {
      toast('This project has no source file', 'error')
      return
    }
    setActiveProject(project)
    setAudio({
      name: project.name,
      path: `local-file://${project.sourcePath}`,
      filePath: project.sourcePath,
      size: 0,
      type: 'audio/*',
    })
  }

  return (
    <div className="flex items-center justify-center h-full px-8 py-6 overflow-y-auto">
      <div className="w-full max-w-3xl flex flex-col gap-5">
        {audio ? (
          <Editor name={audio.name} size={audio.size} type={audio.type} path={audio.path} filePath={audio.filePath} />
        ) : (
          <>
            <Loader />

            {/* Recent projects */}
            {!isLoading && projects.length > 0 && (
              <div>
                <p
                  className="text-[10px] font-medium tracking-widest uppercase text-faint mb-2 px-1"
                  style={{ fontFamily: 'var(--font-family-brand)' }}
                >
                  Recent Projects
                </p>
                <div className="flex flex-col gap-1">
                  {projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onLoad={() => loadProject(project)}
                      onDelete={() => deleteProject(project.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ProjectRow({
  project,
  onLoad,
  onDelete,
}: {
  project: Project
  onLoad: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-border-bright hover:bg-raised transition-colors">
      <div className="w-7 h-7 rounded bg-raised border border-border flex items-center justify-center shrink-0 group-hover:border-border-bright">
        <FolderOpen size={13} className="text-faint" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium truncate">{project.name}</p>
        <p
          className="text-[11px] text-faint mt-0.5 tabular-nums"
          style={{ fontFamily: 'var(--font-family-mono)' }}
        >
          {project.regions.length} region{project.regions.length !== 1 ? 's' : ''}
          {project.sourcePath && (
            <span className="ml-2 opacity-60 truncate">· {project.sourcePath.split('/').pop()}</span>
          )}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-red-400 bg-transparent border-0 p-1.5 cursor-pointer rounded"
      >
        <Trash2 size={12} />
      </button>

      <button
        onClick={onLoad}
        className="text-xs font-medium text-accent hover:text-accent-bright bg-transparent border-0 px-2 py-1 cursor-pointer rounded transition-colors"
        style={{ fontFamily: 'var(--font-family-brand)' }}
      >
        Load
      </button>
    </div>
  )
}
