import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft, ChevronRight, Pencil, Trash2, Copy,
  FolderOpen, Search, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { usePacksStore } from '@/stores/packs'
import { useFilteredSamples } from '@/hooks/useFilteredSamples'
import { mimeTypeFromPath } from '@/utils'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Project, Pack } from '../../electron/types'


export default function AppSidebar() {
  const { currentView, sidebarOpen, toggleSidebar } = useUiStore()

  const labels: Record<string, string> = { chop: 'Projects', library: 'Filters', packs: 'Packs' }

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-surface shrink-0 overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        sidebarOpen ? 'w-56' : 'w-10'
      )}
    >
      {/* Header */}
      <div className="h-11 flex items-center gap-1 px-1.5 border-b border-border shrink-0">
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-7 h-7 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer shrink-0"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {sidebarOpen && (
          <span
            className="flex-1 text-[10px] font-medium tracking-widest uppercase text-faint select-none pl-1"
            style={{ fontFamily: 'var(--font-family-brand)' }}
          >
            {labels[currentView]}
          </span>
        )}

      </div>

      {/* Body */}
      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {currentView === 'chop'    && <ChopContent />}
          {currentView === 'library' && <LibraryContent />}
          {currentView === 'packs'   && <PacksContent />}
        </div>
      )}
    </div>
  )
}

// ─── Chop ───────────────────────────────────────────────────────────────────

function ChopContent() {
  const { projects, activeProject, renameProject, duplicateProject, deleteProject } = useProjectsStore()
  const { setAudio, clearAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()

  const loadProject = (project: Project) => {
    if (!project.sourcePath) return
    setActiveProject(project)
    setAudio({
      name: project.name,
      path: `local-file://${project.sourcePath}`,
      filePath: project.sourcePath,
      size: 0,
      type: mimeTypeFromPath(project.sourcePath),
    })
  }

  const handleNew = () => {
    setActiveProject(null)
    clearAudio()
  }

  return (
    <div className="flex flex-col h-full">
      <ul className="flex-1 overflow-y-auto py-1 list-none m-0 p-0 min-h-0">
        {projects.length === 0 ? (
          <p className="text-[11px] text-faint/50 text-center mt-6 px-3">No projects yet</p>
        ) : (
          projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProject?.id}
              onLoad={() => loadProject(project)}
              onRename={(name) => renameProject(project.id, name)}
              onDuplicate={() => duplicateProject(project.id)}
              onDelete={() => deleteProject(project.id)}
            />
          ))
        )}
      </ul>
      <div className="shrink-0 p-2 border-t border-border">
        <Button size="sm" className="w-full" onClick={handleNew}>
          New Project
        </Button>
      </div>
    </div>
  )
}

function ProjectRow({ project, isActive, onLoad, onRename, onDuplicate, onDelete }: {
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
    <li
      className={cn(
        'group relative flex items-center gap-1.5 px-2 py-2 mx-1 rounded cursor-pointer transition-colors',
        isActive ? 'bg-accent/10' : 'hover:bg-raised'
      )}
      onClick={() => !isRenaming && onLoad()}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />}
      <FolderOpen size={12} strokeWidth={1.5} className={cn('shrink-0', isActive ? 'text-accent' : 'text-faint')} />

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
          <RowAction icon={Pencil} title="Rename" onClick={(e) => { e.stopPropagation(); setIsRenaming(true) }} />
          <RowAction icon={Copy} title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate() }} />
          <RowAction icon={Trash2} title="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }} danger />
        </div>
      )}
    </li>
  )
}

// ─── Library ─────────────────────────────────────────────────────────────────

function LibraryContent() {
  const { samples, searchQuery, projectFilter, filters, setSearchQuery, setProjectFilter, toggleTagFilter, setFilters } = useLibraryStore()
  const { projects } = useProjectsStore()
  const filtered = useFilteredSamples()

  const allTags = [...new Set(samples.flatMap((s) => s.tags))].sort()
  const activeTags = filters.tags ?? []
  const activeSource = filters.source

  return (
    <div className="flex flex-col gap-0 py-2">
      {/* Search */}
      <div className="px-2 mb-3">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-raised border border-border rounded pl-8 pr-2 h-7 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      <SidebarSection label="Source">
        <div className="flex gap-1">
          {(['all', 'local', 'freesound'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilters({ ...filters, source: s === 'all' ? undefined : s })}
              className={cn(
                'flex-1 h-6 rounded text-[10px] font-medium transition-colors bg-transparent border cursor-pointer capitalize',
                (s === 'all' ? !activeSource : activeSource === s)
                  ? 'border-accent/40 text-accent bg-accent/10'
                  : 'border-border text-faint hover:text-muted hover:border-border-bright'
              )}
              style={{ fontFamily: 'var(--font-family-brand)' }}
            >
              {s}
            </button>
          ))}
        </div>
      </SidebarSection>

      {projects.length > 0 && (
        <SidebarSection label="Project">
          <div className="relative">
            <FolderOpen size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <select
              value={projectFilter ?? ''}
              onChange={(e) => setProjectFilter(e.target.value || null)}
              className="w-full appearance-none bg-raised border border-border rounded pl-7 pr-5 h-7 text-xs text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__none__">No project</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          </div>
        </SidebarSection>
      )}

      {allTags.length > 0 && (
        <SidebarSection label="Tags">
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer border bg-transparent',
                  activeTags.includes(tag)
                    ? 'border-accent/40 text-accent bg-accent/10'
                    : 'border-border text-faint hover:text-muted hover:border-border-bright'
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </SidebarSection>
      )}

      <p className="px-3 mt-auto pt-4 text-[10px] text-faint/50" style={{ fontFamily: 'var(--font-family-mono)' }}>
        {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
      </p>
    </div>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 mb-3">
      <p className="text-[9px] font-medium tracking-widest uppercase text-faint/60 mb-1.5 px-0.5" style={{ fontFamily: 'var(--font-family-brand)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Packs ───────────────────────────────────────────────────────────────────

function PacksContent() {
  const { packs, currentPack, hardwareProfileId, setCurrentPack, renamePack, deletePack, createPack } = usePacksStore()
  const [showDialog, setShowDialog] = useState(false)
  const [packName, setPackName] = useState('')

  const handleCreate = async () => {
    if (!packName.trim()) return
    await createPack(packName.trim(), hardwareProfileId)
    setPackName('')
    setShowDialog(false)
  }

  return (
    <div className="flex flex-col h-full">
      <ul className="flex-1 overflow-y-auto py-1 list-none m-0 p-0 min-h-0">
        {packs.length === 0 ? (
          <p className="text-[11px] text-faint/50 text-center mt-6 px-3">No packs yet</p>
        ) : (
          packs.map((pack) => (
            <PackRow
              key={pack.id}
              pack={pack}
              isActive={pack.id === currentPack?.id}
              onSelect={() => setCurrentPack(pack)}
              onRename={(name) => renamePack(pack.id, name)}
              onDelete={() => deletePack(pack.id)}
            />
          ))
        )}
      </ul>
      <div className="shrink-0 p-2 border-t border-border">
        <Button size="sm" className="w-full" onClick={() => setShowDialog(true)}>
          New Pack
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogTitle>New Pack</DialogTitle>
          <Input
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
            placeholder="Pack name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleCreate} disabled={!packName.trim()}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PackRow({ pack, isActive, onSelect, onRename, onDelete }: {
  pack: Pack
  isActive: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(pack.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraftName(pack.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, pack.name])

  const commitRename = () => {
    setIsRenaming(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== pack.name) onRename(trimmed)
  }

  return (
    <li
      className={cn(
        'group relative flex items-center gap-1.5 px-2 py-2 mx-1 rounded cursor-pointer transition-colors',
        isActive ? 'bg-accent/10' : 'hover:bg-raised'
      )}
      onClick={() => !isRenaming && onSelect()}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />}

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
          {pack.name}
        </span>
      )}

      {!isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <RowAction icon={Pencil} title="Rename" onClick={(e) => { e.stopPropagation(); setIsRenaming(true) }} />
          <RowAction icon={Trash2} title="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }} danger />
        </div>
      )}
    </li>
  )
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function RowAction({ icon: Icon, title, onClick, danger }: {
  icon: React.ElementType
  title: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-5 h-5 flex items-center justify-center rounded text-faint bg-transparent border-0 cursor-pointer transition-colors hover:bg-raised',
        danger ? 'hover:text-red-400' : 'hover:text-ink'
      )}
    >
      <Icon size={10} />
    </button>
  )
}
