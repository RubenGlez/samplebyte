import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronLeft, ChevronRight, Pencil, Copy, Trash2, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '../../electron/types'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  projects: Project[]
  activeProjectId: string | null
  onNew: () => void
  onLoad: (project: Project) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function Sidebar({
  isOpen, onToggle, projects, activeProjectId,
  onNew, onLoad, onRename, onDuplicate, onDelete,
}: SidebarProps) {
  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-surface shrink-0 overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        isOpen ? 'w-56' : 'w-10'
      )}
    >
      {/* Header */}
      <div className="h-11 flex items-center gap-1 px-1.5 border-b border-border shrink-0">
        <button
          onClick={onToggle}
          title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-7 h-7 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer shrink-0"
        >
          {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {isOpen && (
          <>
            <span
              className="flex-1 text-[10px] font-medium tracking-widest uppercase text-faint select-none pl-1"
              style={{ fontFamily: 'var(--font-family-brand)' }}
            >
              Projects
            </span>
            <button
              onClick={onNew}
              title="New project"
              className="w-7 h-7 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </>
        )}
      </div>

      {/* Project list */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 ? (
            <p className="text-[11px] text-faint/50 text-center mt-6 px-3">No projects yet</p>
          ) : (
            projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                onLoad={() => onLoad(project)}
                onRename={(name) => onRename(project.id, name)}
                onDuplicate={() => onDuplicate(project.id)}
                onDelete={() => onDelete(project.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ProjectRow({
  project, isActive, onLoad, onRename, onDuplicate, onDelete,
}: {
  project: Project
  isActive: boolean
  onLoad: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraftName(project.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, project.name])

  const commitRename = () => {
    setIsRenaming(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== project.name) onRename(trimmed)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 px-2 py-2 mx-1 rounded cursor-pointer transition-colors',
        isActive ? 'bg-accent/10' : 'hover:bg-raised'
      )}
      onClick={() => !isRenaming && onLoad()}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
      )}

      <FolderOpen
        size={12}
        strokeWidth={1.5}
        className={cn('shrink-0', isActive ? 'text-accent' : 'text-faint')}
      />

      {isRenaming ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            if (e.key === 'Escape') setIsRenaming(false)
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-0 border-b border-accent/50 outline-none text-xs text-ink py-0 px-0"
          autoFocus
        />
      ) : (
        <span className={cn('flex-1 text-xs truncate leading-tight', isActive ? 'text-ink' : 'text-muted')}>
          {project.name}
        </span>
      )}

      {!isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setIsRenaming(true) }}
            title="Rename"
            className="w-5 h-5 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            title="Duplicate"
            className="w-5 h-5 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
          >
            <Copy size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete"
            className="w-5 h-5 flex items-center justify-center rounded text-faint hover:text-red-400 hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
