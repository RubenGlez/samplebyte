import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl, mimeTypeFromPath } from '@/utils'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { Project } from '@/types'

const GRID = 'grid-cols-[28px_1fr_120px_64px_52px_72px_140px]'

// Row height in px (matches `h-[34px]` on LibraryRow). The list is virtualized against this
// fixed height so only on-screen rows mount — each row renders a ~100-bar waveform SVG, so
// mounting all ~900+ at once buries the renderer under 90k+ DOM nodes.
const ROW_H = 34
const OVERSCAN = 8

// Cap on concurrent decode+analyse during bulk re-analyze. Matches the import path's bound so
// memory and the analysis worker pool stay in check.
const ANALYSIS_CONCURRENCY = 4

type MenuState = { item: LibraryBrowserItem; x: number; y: number }
type DeleteState = { item: LibraryBrowserItem; packRefs: number }
type BulkDeleteState = { items: LibraryBrowserItem[]; packRefs: number }

export default function LibraryView() {
  const { isLoading, fetchSamples, deleteSample, updateSample } = useLibraryStore()
  const { projects, fetchProjects, setActiveProject } = useProjectsStore()
  const { setAudio } = usePlayerStore()
  const { setView } = useUiStore()
  const { toast } = useToastStore()

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState | null>(null)
  const [pendingRename, setPendingRename] = useState<LibraryBrowserItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDelete, setBulkDelete] = useState<BulkDeleteState | null>(null)
  // In-flight long action, so its trigger button can disable + show progress. 'prepare' covers the
  // pack-ref lookups before the bulk-delete dialog opens; 'deleting'/'reanalyzing' the loops.
  const [busy, setBusy] = useState<null | 'prepare' | 'deleting' | 'reanalyzing'>(null)

  useEffect(() => {
    fetchSamples()
    fetchProjects()
  }, [fetchSamples, fetchProjects])

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])
  const filtered = useFilteredSamples()

  // Virtualized scroll window: only rows intersecting the viewport (plus overscan) are mounted.
  // A callback ref (not useEffect) wires up measurement because the scroller mounts only after
  // the initial `isLoading` gate clears — an effect with [] deps would miss that later mount.
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const roRef = useRef<ResizeObserver | null>(null)
  const setScroller = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!el) return
    setViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    roRef.current = ro
  }, [])
  const total = filtered.length
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIndex = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN)
  const visible = filtered.slice(startIndex, endIndex)

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

  // Stable callbacks so memoized rows don't all re-render when one checkbox toggles.
  const toggleOne = useCallback((id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }), [])
  const handleRowContextMenu = useCallback((e: React.MouseEvent, item: LibraryBrowserItem) => {
    e.preventDefault()
    setMenu({ item, x: e.clientX, y: e.clientY })
  }, [])
  const handleDoubleClickName = useCallback((item: LibraryBrowserItem) => setPendingRename(item), [])
  const handleRenameCommit = useCallback(() => setPendingRename(null), [])

  const allSelected = filtered.length > 0 && filtered.every((it) => selected.has(it.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((it) => it.id)))

  const openBulkDelete = async () => {
    const items = filtered.filter((it) => selected.has(it.id))
    if (items.length === 0 || busy) return
    setBusy('prepare')
    try {
      const counts = await Promise.all(
        items.map((it) => window.api.library.getPackSlotRefCount(it.sample.id))
      )
      setBulkDelete({ items, packRefs: counts.reduce((a, b) => a + b, 0) })
    } finally {
      setBusy(null)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDelete || busy === 'deleting') return
    setBusy('deleting')
    try {
      for (const it of bulkDelete.items) {
        await deleteSample(it.sample.id)
      }
      const n = bulkDelete.items.length
      toast(`Deleted ${n} sound${n !== 1 ? 's' : ''}`, 'success')
      setSelected(new Set())
      setBulkDelete(null)
    } finally {
      setBusy(null)
    }
  }

  const handleBulkReanalyze = async () => {
    if (busy) return
    const targets = filtered.filter(
      (it) => selected.has(it.id) && (it.bpm == null || it.musicalKey == null)
    )
    if (targets.length === 0) {
      toast('Nothing to analyze — selected samples already have BPM and key', 'info')
      return
    }
    setBusy('reanalyzing')
    try {
      const n = targets.length
      toast(`Analyzing ${n} sample${n !== 1 ? 's' : ''}…`, 'info')
      await forEachConcurrent(targets, ANALYSIS_CONCURRENCY, async (it) => {
        try {
          const result = await analyzeAudioUrl(toLocalFileUrl(it.filePath))
          await updateSample(it.sample.id, result)
        } catch { /* non-fatal */ }
      })
      toast(`Re-analyzed ${n} sample${n !== 1 ? 's' : ''}`, 'success')
    } finally {
      setBusy(null)
    }
  }

  const handleEdit = (item: LibraryBrowserItem) => {
    setActiveProject(null)
    setAudio({
      name: item.name,
      path: toLocalFileUrl(item.filePath),
      filePath: item.filePath,
      size: 0,
      type: mimeTypeFromPath(item.filePath),
      source: item.source === 'freesound' ? 'freesound' : 'local',
    })
    setView('chop')
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete || busy === 'deleting') return
    setBusy('deleting')
    try {
      await deleteSample(pendingDelete.item.sample.id)
      setPendingDelete(null)
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteRequest = async (item: LibraryBrowserItem) => {
    const packRefs = await window.api.library.getPackSlotRefCount(item.sample.id)
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

          <div
            ref={setScroller}
            className="flex-1 overflow-y-auto"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ height: total * ROW_H, position: 'relative' }}>
              <div style={{ transform: `translateY(${startIndex * ROW_H}px)` }}>
                {visible.map((item, i) => {
                  const index = startIndex + i
                  return (
                    <LibraryRow
                      key={item.id}
                      item={item}
                      project={item.projectId ? projectsById[item.projectId] : undefined}
                      striped={index % 2 === 1}
                      selected={selected.has(item.id)}
                      anySelected={selected.size > 0}
                      onToggleSelect={toggleOne}
                      isRenaming={pendingRename?.id === item.id}
                      onRenameCommit={handleRenameCommit}
                      onContextMenu={handleRowContextMenu}
                      onDoubleClickName={handleDoubleClickName}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-t border-border bg-surface">
              <span className="text-[12px] text-muted tabular-nums">{selected.size} selected</span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleBulkReanalyze} disabled={busy !== null}>
                <RefreshCw size={12} className={busy === 'reanalyzing' ? 'animate-spin' : undefined} />
                {busy === 'reanalyzing' ? 'Analyzing…' : 'Re-analyze'}
              </Button>
              <Button variant="danger" size="sm" onClick={openBulkDelete} disabled={busy !== null}>
                <Trash2 size={12} /> {busy === 'prepare' ? 'Preparing…' : 'Delete'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={busy !== null}>Clear</Button>
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

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && busy !== 'deleting' && setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete "{pendingDelete?.item.name}"?</DialogTitle>
          {pendingDelete && pendingDelete.packRefs > 0 ? (
            <p className="text-[13px] text-muted">
              This sound is used in {pendingDelete.packRefs} pack slot{pendingDelete.packRefs !== 1 ? 's' : ''}. Those pads keep their own audio and still export; you can rebuild the library sample from a pad later.
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              This sample will be permanently deleted from your library.
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={busy === 'deleting'}>Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="danger" onClick={handleDeleteConfirm} disabled={busy === 'deleting'}>
              {busy === 'deleting' ? 'Deleting…' : `Delete${pendingDelete && pendingDelete.packRefs > 0 ? ' anyway' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkDelete} onOpenChange={(open) => !open && busy !== 'deleting' && setBulkDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete {bulkDelete?.items.length} sound{bulkDelete && bulkDelete.items.length !== 1 ? 's' : ''}?</DialogTitle>
          {bulkDelete && bulkDelete.packRefs > 0 ? (
            <p className="text-[13px] text-muted">
              {bulkDelete.packRefs} pack slot{bulkDelete.packRefs !== 1 ? 's' : ''} reference these sounds. Those pads keep their own audio and still export; you can rebuild library samples from them later.
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              These sounds will be permanently removed from your library.
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={busy === 'deleting'}>Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="danger" onClick={handleBulkDeleteConfirm} disabled={busy === 'deleting'}>
              {busy === 'deleting' ? 'Deleting…' : `Delete${bulkDelete && bulkDelete.packRefs > 0 ? ' anyway' : ''}`}
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
      {/* shrink-0 is required: as a flex item the SVG's width otherwise collapses to ~2px (the
          flex container squeezes the main axis). w-3 h-3 sizes it; shrink-0 stops the collapse. */}
      {checked && <Check className="w-3 h-3 shrink-0" strokeWidth={3} />}
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
        <p className="text-[12px] text-faint/70 mt-1">Create chops in a project or import a folder using the sidebar</p>
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

const LibraryRow = memo(function LibraryRow({
  item, project, striped, selected, anySelected, onToggleSelect,
  isRenaming, onRenameCommit, onContextMenu, onDoubleClickName,
}: {
  item: LibraryBrowserItem
  project: Project | undefined
  striped: boolean
  selected: boolean
  anySelected: boolean
  onToggleSelect: (id: string) => void
  isRenaming: boolean
  onRenameCommit: () => void
  onContextMenu: (e: React.MouseEvent, item: LibraryBrowserItem) => void
  onDoubleClickName: (item: LibraryBrowserItem) => void
}) {
  const { updateSample } = useLibraryStore()
  const { isPlaying, toggle } = useAudioPlayer(toLocalFileUrl(item.filePath), null)

  const waveformData = item.sample.waveformData

  const handleRename = (name: string) => {
    void updateSample(item.sample.id, { name })
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
      className={cn(
        'group grid items-center px-4 h-[34px] cursor-pointer transition-colors',
        selected
          ? 'bg-accent/[0.07]'
          : isPlaying
            ? 'bg-live/[0.07]'
            : striped
              ? 'bg-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.04)]'
              : 'hover:bg-[rgba(255,255,255,0.04)]',
        GRID
      )}
      onClick={() => { if (!isRenaming) toggle() }}
      onContextMenu={(e) => onContextMenu(e, item)}
    >
      {/* Selection checkbox */}
      <SelectBox checked={selected} onToggle={() => onToggleSelect(item.id)} anySelected={anySelected} />

      {/* Name + play indicator */}
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <div className={cn(
          'w-5 h-5 flex items-center justify-center rounded-full shrink-0 transition-colors',
          isPlaying ? 'text-live' : 'text-faint/0 group-hover:text-faint'
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
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickName(item) }}
          >
            {item.name}
            {item.sample.license && (
              // Attribution indicator for Creative Commons sources; full credit on hover, and it's
              // written to credits.txt on export (F24).
              <span
                className="ml-1.5 text-[10px] text-faint/70 align-middle"
                title={`${item.sample.license}${item.sample.author ? ` — ${item.sample.author}` : ''}${item.sample.freesoundId ? ` (Freesound #${item.sample.freesoundId})` : ''}`}
              >
                CC
              </span>
            )}
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
                  className={isPlaying ? 'fill-live/70' : 'fill-[rgba(255,255,255,0.16)]'}
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Duration */}
      <span className="text-[12px] text-faint tabular-nums text-right font-readout pr-1">
        {item.duration != null ? formatTime(item.duration) : '—'}
      </span>

      {/* BPM */}
      <span className="text-[12px] text-faint tabular-nums text-right font-readout pr-1">
        {item.bpm != null ? Math.round(item.bpm) : '—'}
      </span>

      {/* Key */}
      <span className="text-[12px] text-faint font-readout whitespace-nowrap">
        {item.musicalKey ?? '—'}
      </span>

      {/* Project */}
      <span className="text-[12px] text-faint/80 truncate pr-2">
        {project?.name ?? '—'}
      </span>
    </div>
  )
})
