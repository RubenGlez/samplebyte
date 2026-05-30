import { useState } from 'react'
import { Pencil, Trash2, Copy, Grid2x2, FolderOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { usePacksStore } from '@/stores/packs'
import { useFilteredSamples } from '@/hooks/useFilteredSamples'
import { useInlineRename } from '@/hooks/useInlineRename'
import { fileNameFromPath, mimeTypeFromPath, toLocalFileUrl } from '@/utils'
import { FilterControls } from '@/components/FilterControls'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Project, Pack } from '../../electron/types'

export default function AppSidebar() {
  const { currentView, sidebarOpen } = useUiStore()

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-surface shrink-0 overflow-hidden',
        'transition-[width,opacity] duration-200 ease-in-out',
        sidebarOpen ? 'w-56 opacity-100' : 'w-0 opacity-0'
      )}
    >
      <div className="flex-1 overflow-y-auto min-h-0 pt-1">
        {currentView === 'chop'    && <ChopContent />}
        {currentView === 'library' && <LibraryContent />}
        {currentView === 'packs'   && <PacksContent />}
      </div>
    </div>
  )
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-faint select-none tracking-wide">
      {label}
    </p>
  )
}

// ─── Chop ────────────────────────────────────────────────────────────────────

function ChopContent() {
  const { projects, activeProject, renameProject, duplicateProject, deleteProject } = useProjectsStore()
  const { setAudio, clearAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()

  const loadProject = (project: Project) => {
    if (!project.sourcePath) return
    setActiveProject(project)
    setAudio({
      name: project.sourceName ?? fileNameFromPath(project.sourcePath),
      path: toLocalFileUrl(project.sourcePath),
      filePath: project.sourcePath,
      size: 0,
      type: mimeTypeFromPath(project.sourcePath),
    })
  }

  const handleDeleteProject = async (project: Project) => {
    const remaining = projects.filter((p) => p.id !== project.id)
    const nextProject = project.id === activeProject?.id ? remaining[0] : activeProject

    await deleteProject(project.id)

    if (project.id !== activeProject?.id) return
    if (nextProject?.sourcePath) {
      loadProject(nextProject)
    } else {
      setActiveProject(null)
      clearAudio()
    }
  }

  const handleNew = () => {
    setActiveProject(null)
    clearAudio()
  }

  return (
    <div className="flex flex-col h-full">
      <SectionHeader label="Projects" />
      <ul className="flex-1 overflow-y-auto list-none m-0 p-0 px-1 min-h-0">
        {projects.length === 0 ? (
          <p className="text-[12px] text-faint/50 text-center mt-6 px-3">No projects yet</p>
        ) : (
          projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProject?.id}
              onLoad={() => loadProject(project)}
              onRename={(name) => renameProject(project.id, name)}
              onDuplicate={() => duplicateProject(project.id)}
              onDelete={() => handleDeleteProject(project)}
            />
          ))
        )}
      </ul>
      <div className="shrink-0 px-2 py-2 border-t border-border">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[12px] text-muted hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
        >
          <Plus size={13} strokeWidth={2} />
          New Project
        </button>
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
  const { isRenaming, draftName, inputRef, setDraftName, startRename, commitRename, cancelRename } =
    useInlineRename(project.name, onRename)

  return (
    <li
      className={cn(
        'group relative flex items-center gap-2 px-2 h-[28px] rounded-md cursor-pointer transition-colors',
        isActive ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-raised hover:text-ink'
      )}
      onClick={() => !isRenaming && onLoad()}
    >
      <FolderOpen
        size={13}
        strokeWidth={1.5}
        className={cn('shrink-0', isActive ? 'text-accent/80' : 'text-faint')}
      />

      {isRenaming ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            if (e.key === 'Escape') cancelRename()
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-0 border-b border-accent/40 outline-none text-[12px] text-ink py-0 px-0"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-[12px] truncate leading-none">
          {project.name}
        </span>
      )}

      {!isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <RowAction icon={Pencil}  title="Rename"    onClick={(e) => { e.stopPropagation(); startRename() }} />
          <RowAction icon={Copy}    title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate() }} />
          <RowAction icon={Trash2}  title="Delete"    onClick={(e) => { e.stopPropagation(); onDelete() }} danger />
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
  const activeSource = (filters.source ?? 'all') as 'all' | 'local' | 'freesound'

  return (
    <div className="flex flex-col gap-2 py-1 px-2">
      <SectionHeader label="Filters" />
      <FilterControls
        search={searchQuery}
        onSearchChange={setSearchQuery}
        source={activeSource}
        onSourceChange={(s) => setFilters({ ...filters, source: s === 'all' ? undefined : s })}
        projects={projects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        allTags={allTags}
        activeTags={activeTags}
        onTagToggle={toggleTagFilter}
        bpm={filters.bpm}
        onBpmChange={(bpm) => setFilters({ ...filters, bpm })}
        musicalKey={filters.key}
        onKeyChange={(key) => setFilters({ ...filters, key })}
      />
      <p className="text-[11px] text-faint/60 px-1">
        {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
      </p>
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
      <SectionHeader label="Packs" />
      <ul className="flex-1 overflow-y-auto list-none m-0 p-0 px-1 min-h-0">
        {packs.length === 0 ? (
          <p className="text-[12px] text-faint/50 text-center mt-6 px-3">No packs yet</p>
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
      <div className="shrink-0 px-2 py-2 border-t border-border">
        <button
          onClick={() => setShowDialog(true)}
          className="w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[12px] text-muted hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
        >
          <Plus size={13} strokeWidth={2} />
          New Pack
        </button>
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
  const { isRenaming, draftName, inputRef, setDraftName, startRename, commitRename, cancelRename } =
    useInlineRename(pack.name, onRename)

  return (
    <li
      className={cn(
        'group relative flex items-center gap-2 px-2 h-[28px] rounded-md cursor-pointer transition-colors',
        isActive ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-raised hover:text-ink'
      )}
      onClick={() => !isRenaming && onSelect()}
    >
      <Grid2x2
        size={12}
        strokeWidth={1.5}
        className={cn('shrink-0', isActive ? 'text-accent/80' : 'text-faint')}
      />

      {isRenaming ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            if (e.key === 'Escape') cancelRename()
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-0 border-b border-accent/40 outline-none text-[12px] text-ink py-0 px-0"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-[12px] truncate leading-none">
          {pack.name}
        </span>
      )}

      {!isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <RowAction icon={Pencil} title="Rename" onClick={(e) => { e.stopPropagation(); startRename() }} />
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
        'w-5 h-5 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer transition-colors text-faint hover:bg-overlay',
        danger ? 'hover:text-red-400' : 'hover:text-ink'
      )}
    >
      <Icon size={11} />
    </button>
  )
}
