import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, Check, Trash2, RefreshCw } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import { forEachConcurrent } from '@/stores/utils'
import { analyzeAudioUrl } from '@/lib/audioAnalysis'
import { type LibraryBrowserItem, useFilteredSamples } from '@/hooks/useFilteredSamples'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useChopWaveform } from '@/hooks/useChopWaveform'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl, fileNameFromPath, mimeTypeFromPath } from '@/utils'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { Project } from '@/types'

const GRID = 'grid-cols-[28px_1fr_120px_64px_52px_72px_140px]'

// Cap on concurrent decode+analyse during bulk re-analyze. Matches the import path's bound so
// memory and the analysis worker pool stay in check.
const ANALYSIS_CONCURRENCY = 4

type MenuState = { item: LibraryBrowserItem; x: number; y: number }
type DeleteState = { item: LibraryBrowserItem; packRefs: number }
type BulkDeleteState = { items: LibraryBrowserItem[]; packRefs: number }

export default function LibraryView() {
  const { isLoading, fetchSamples, deleteSample, deleteProjectChop, updateSample } = useLibraryStore()
  const { projects, fetchProjects, setActiveProject } = useProjectsStore()
  const { setAudio } = usePlayerStore()
  const { setView, setPendingFocusStart } = useUiStore()
  const { toast } = useToastStore()

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState | null>(null)
  const [pendingRename, setPendingRename] = useState<LibraryBrowserItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDelete, setBulkDelete] = useState<BulkDeleteState | null>(null)

  useEffect(() => {
    fetchSamples()
    fetchProjects()
  }, [fetchSamples, fetchProjects])

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])
  const filtered = useFilteredSamples()

  // Prune selection to what's still visible: items can leave the filtered list when the search or
  // filters change, or after a delete. Return the same Set reference when nothing changed so this
  // effect can't loop.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const ids = new Set(filtered.map((it) => it.id))
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filtered])

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = filtered.length > 0 && filtered.every((it) => selected.has(it.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((it) => it.id)))

  const openBulkDelete = async () => {
    const items = filtered.filter((it) => selected.has(it.id))
    if (items.length === 0) return
    const counts = await Promise.all(
      items.map((it) => {
        const id = it.kind === 'sample' ? it.sample.id : it.chop.id
        const type = it.kind === 'sample' ? 'sample' : 'project-chop'
        return window.api.library.getPackSlotRefCount(id, type)
      })
    )
    setBulkDelete({ items, packRefs: counts.reduce((a, b) => a + b, 0) })
  }

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDelete) return
    for (const it of bulkDelete.items) {
      if (it.kind === 'sample') await deleteSample(it.sample.id)
      else await deleteProjectChop(it.chop.id)
    }
    const n = bulkDelete.items.length
    toast(`Deleted ${n} sound${n !== 1 ? 's' : ''}`, 'success')
    setSelected(new Set())
    setBulkDelete(null)
  }

  const handleBulkReanalyze = async () => {
    const targets = filtered.filter(
      (it) => it.kind === 'sample' && selected.has(it.id) && (it.bpm == null || it.musicalKey == null)
    )
    if (targets.length === 0) {
      toast('Nothing to analyze — selected samples already have BPM and key', 'info')
      return
    }
    const n = targets.length
    toast(`Analyzing ${n} sample${n !== 1 ? 's' : ''}…`, 'info')
    await forEachConcurrent(targets, ANALYSIS_CONCURRENCY, async (it) => {
      if (it.kind !== 'sample') return
      try {
        const result = await analyzeAudioUrl(toLocalFileUrl(it.filePath))
        await updateSample(it.sample.id, result)
      } catch { /* non-fatal */ }
    })
    toast(`Re-analyzed ${n} sample${n !== 1 ? 's' : ''}`, 'success')
  }

  const handleEdit = (item: LibraryBrowserItem) => {
    if (item.kind === 'project-chop') {
      const project = projectsById[item.projectId]
      if (!project?.sourcePath) return
      setActiveProject(project)
      setAudio({
        name: project.sourceName ?? fileNameFromPath(project.sourcePath),
        path: toLocalFileUrl(project.sourcePath),
        filePath: project.sourcePath,
        size: 0,
        type: mimeTypeFromPath(project.sourcePath),
        source: project.source,
      })
      setPendingFocusStart(item.chop.start)
    } else {
      setActiveProject(null)
      setAudio({
        name: item.name,
        path: toLocalFileUrl(item.filePath),
        filePath: item.filePath,
        size: 0,
        type: mimeTypeFromPath(item.filePath),
        source: item.source,
      })
    }
    setView('chop')
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return
    const { item } = pendingDelete
    if (item.kind === 'sample') {
      await deleteSample(item.sample.id)
    } else {
      await deleteProjectChop(item.chop.id)
    }
    setPendingDelete(null)
  }

  const handleDeleteRequest = async (item: LibraryBrowserItem) => {
    const id = item.kind === 'sample' ? item.sample.id : item.chop.id
    const type = item.kind === 'sample' ? 'sample' : 'project-chop'
    const packRefs = await window.api.library.getPackSlotRefCount(id, type)
    setPendingDelete({ item, packRefs })
  }

  const menuItems = (item: LibraryBrowserItem): ContextMenuItem[] => [
    { label: 'Edit in Chop', onClick: () => handleEdit(item) },
    { label: 'Rename', onClick: () => setPendingRename(item) },
    { label: 'Delete', onClick: () => handleDeleteRequest(item), danger: true },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-faint text-[13px]">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className={cn('grid shrink-0 px-4 h-8 items-center border-b border-border bg-surface', GRID)}>
            <SelectBox checked={allSelected} onToggle={toggleAll} alwaysVisible />
            <ColHeader label="Name" />
            <ColHeader label="" />
            <ColHeader label="Duration" right />
            <ColHeader label="BPM"      right />
            <ColHeader label="Key" />
            <ColHeader label="Project" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((item, i) => (
              <LibraryRow
                key={item.id}
                item={item}
                project={item.projectId ? projectsById[item.projectId] : undefined}
                striped={i % 2 === 1}
                selected={selected.has(item.id)}
                anySelected={selected.size > 0}
                onToggleSelect={() => toggleOne(item.id)}
                isRenaming={pendingRename?.id === item.id}
                onRenameCommit={() => setPendingRename(null)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ item, x: e.clientX, y: e.clientY })
                }}
                onDoubleClickName={() => setPendingRename(item)}
              />
            ))}
          </div>

          {selected.size > 0 && (
            <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-t border-border bg-surface">
              <span className="text-[12px] text-muted tabular-nums">{selected.size} selected</span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleBulkReanalyze}>
                <RefreshCw size={12} /> Re-analyze
              </Button>
              <Button variant="danger" size="sm" onClick={openBulkDelete}>
                <Trash2 size={12} /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
        </>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete "{pendingDelete?.item.name}"?</DialogTitle>
          {pendingDelete && pendingDelete.packRefs > 0 ? (
            <p className="text-[13px] text-muted">
              This sound is used in {pendingDelete.packRefs} pack slot{pendingDelete.packRefs !== 1 ? 's' : ''}. Deleting it will remove those slots permanently.
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              {pendingDelete?.item.kind === 'sample'
                ? 'This sample will be permanently deleted from your library.'
                : 'This chop will be removed from its project.'}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="danger" onClick={handleDeleteConfirm}>
              Delete{pendingDelete && pendingDelete.packRefs > 0 ? ' anyway' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkDelete} onOpenChange={(open) => !open && setBulkDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete {bulkDelete?.items.length} sound{bulkDelete && bulkDelete.items.length !== 1 ? 's' : ''}?</DialogTitle>
          {bulkDelete && bulkDelete.packRefs > 0 ? (
            <p className="text-[13px] text-muted">
              {bulkDelete.packRefs} pack slot{bulkDelete.packRefs !== 1 ? 's' : ''} reference these sounds. Deleting will remove those slots permanently.
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              These sounds will be permanently removed. Samples are deleted from your library; chops are removed from their projects.
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="danger" onClick={handleBulkDeleteConfirm}>
              Delete{bulkDelete && bulkDelete.packRefs > 0 ? ' anyway' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SelectBox({
  checked, onToggle, alwaysVisible, anySelected,
}: {
  checked: boolean
  onToggle: () => void
  alwaysVisible?: boolean
  anySelected?: boolean
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={cn(
        'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors shrink-0',
        checked ? 'bg-accent border-accent text-white' : 'border-border bg-transparent hover:border-faint',
        !checked && !alwaysVisible && !anySelected && 'opacity-0 group-hover:opacity-100'
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-faint">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-25">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <div className="text-center">
        <p className="text-[13px] text-muted">No samples yet</p>
        <p className="text-[12px] text-faint/70 mt-1">Create regions in a project or import a folder using the sidebar</p>
      </div>
    </div>
  )
}

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span className={cn('text-[11px] font-medium text-faint select-none tracking-wide', right && 'text-right')}>
      {label}
    </span>
  )
}

function LibraryRow({
  item, project, striped, selected, anySelected, onToggleSelect,
  isRenaming, onRenameCommit, onContextMenu, onDoubleClickName,
}: {
  item: LibraryBrowserItem
  project: Project | undefined
  striped: boolean
  selected: boolean
  anySelected: boolean
  onToggleSelect: () => void
  isRenaming: boolean
  onRenameCommit: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClickName: () => void
}) {
  const { updateSample, renameProjectChop } = useLibraryStore()
  const region = item.kind === 'project-chop' ? { start: item.start, end: item.end } : null
  const { isPlaying, toggle } = useAudioPlayer(toLocalFileUrl(item.filePath), region)

  const rowRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const chopWaveform = useChopWaveform(
    item.kind === 'project-chop' && inView ? item.filePath : null,
    item.kind === 'project-chop' ? item.start : 0,
    item.kind === 'project-chop' ? item.end : 0,
  )
  const waveformData = item.kind === 'sample' ? item.sample.waveformData : chopWaveform

  const handleRename = (name: string) => {
    if (item.kind === 'sample') void updateSample(item.sample.id, { name })
    else void renameProjectChop(item.chop.id, name)
    onRenameCommit()
  }

  const [draftName, setDraftName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraftName(item.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, item.name])

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== item.name) handleRename(trimmed)
    else onRenameCommit()
  }

  const cancelRename = () => onRenameCommit()

  return (
    <div
      ref={rowRef}
      className={cn(
        'group grid items-center px-4 h-[34px] cursor-pointer transition-colors',
        selected
          ? 'bg-accent/[0.07]'
          : isPlaying
            ? 'bg-accent/10'
            : striped
              ? 'bg-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.04)]'
              : 'hover:bg-[rgba(255,255,255,0.04)]',
        GRID
      )}
      onClick={() => { if (!isRenaming) toggle() }}
      onContextMenu={onContextMenu}
    >
      {/* Selection checkbox */}
      <SelectBox checked={selected} onToggle={onToggleSelect} anySelected={anySelected} />

      {/* Name + play indicator */}
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <div className={cn(
          'w-5 h-5 flex items-center justify-center rounded-full shrink-0 transition-colors',
          isPlaying ? 'text-accent' : 'text-faint/0 group-hover:text-faint'
        )}>
          {isPlaying
            ? <Square size={9} fill="currentColor" />
            : <Play   size={9} fill="currentColor" className="translate-x-px" />
          }
        </div>

        {isRenaming ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { cancelRename(); onRenameCommit() }
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent border-0 border-b border-accent/40 outline-none text-[13px] text-ink py-0 px-0"
            autoFocus
          />
        ) : (
          <span
            className={cn('flex-1 text-[13px] truncate min-w-0', isPlaying && 'text-ink font-medium')}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickName() }}
          >
            {item.name}
          </span>
        )}
      </div>

      {/* Waveform */}
      <div className="flex items-center pr-2">
        {waveformData && (
          <svg viewBox="0 0 100 100" className="w-full h-4" preserveAspectRatio="none">
            {waveformData.map((v, i) => {
              const barW = 100 / waveformData.length
              const h = Math.max(2, v * 100)
              return (
                <rect
                  key={i}
                  x={i * barW + 0.1}
                  width={barW - 0.2}
                  y={50 - h / 2}
                  height={h}
                  className={isPlaying ? 'fill-accent/60' : 'fill-[rgba(255,255,255,0.15)]'}
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Duration */}
      <span className="text-[12px] text-faint tabular-nums text-right font-mono pr-1">
        {item.duration != null ? formatTime(item.duration) : '—'}
      </span>

      {/* BPM */}
      <span className="text-[12px] text-faint tabular-nums text-right font-mono pr-1">
        {item.bpm != null ? Math.round(item.bpm) : '—'}
      </span>

      {/* Key */}
      <span className="text-[12px] text-faint font-mono whitespace-nowrap">
        {item.musicalKey ?? '—'}
      </span>

      {/* Project */}
      <span className="text-[12px] text-faint/80 truncate pr-2">
        {project?.name ?? (item.kind === 'project-chop' ? item.projectName : '—')}
      </span>
    </div>
  )
}
