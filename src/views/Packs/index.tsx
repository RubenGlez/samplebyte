import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { AlertTriangle, Check, Download, RefreshCw } from 'lucide-react'
import { usePacksStore } from '@/stores/packs'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { useUiStore, type PadAuditionMode } from '@/stores/ui'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { FilterControls } from '@/components/FilterControls'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import type { PackSlot, PackSourceItem, ProjectChop, Sample } from '@/types'

// A pad whose source has moved out from under it. 'drift': the source chop was edited and the pad's
// owned audio is stale (offer update-from-source). 'orphan': the origin chop was deleted so the
// library sample is gone, but the pad still owns its audio (offer regenerate-to-library).
type PadRecovery = {
  slotNumber: number
  slot: PackSlot
  kind: 'drift' | 'orphan'
  sample?: Sample
}

// Source row pitch in px: DraggableSource is h-[28px] with a 1px flex gap. The source panel is
// virtualized against this so a 900+ sample library mounts only the visible dnd-kit draggables.
const SOURCE_ROW_H = 29
const SOURCE_OVERSCAN = 8

export default function PacksView() {
  const { currentPack, slots, hardwareProfileId, profiles, fetchPacks, setSlot, clearSlot, exportPack, setHardwareProfile, loadSlots } = usePacksStore()
  const { padAuditionMode, setPadAuditionMode } = useUiStore()
  const { samples, fetchSamples } = useLibraryStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { toast } = useToastStore()

  const [activeSource, setActiveSource] = useState<PackSourceItem | null>(null)
  const [packSaveStatus, setPackSaveStatus] = useState<'idle' | 'saved'>('idle')
  const packSaveTimer = useRef<number | null>(null)
  const [projectChops, setProjectChops] = useState<Array<ProjectChop & { projectName: string; sourcePath: string | null }>>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'freesound'>('all')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [bpmFilter, setBpmFilter] = useState<number | undefined>()
  const [keyFilter, setKeyFilter] = useState<string | undefined>()
  const [isExporting, setIsExporting] = useState(false)
  const [samplesLoaded, setSamplesLoaded] = useState(false)

  const handleExport = async () => {
    if (!currentPack) return
    const outputDir = await window.api.fs.pickFolder()
    if (!outputDir) return
    setIsExporting(true)
    try {
      const result = await exportPack(outputDir)
      const base = `${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} exported`
      toast(result.failed > 0 ? `${base}, ${result.failed} failed` : base)
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const flashPackSaved = () => {
    setPackSaveStatus('saved')
    if (packSaveTimer.current !== null) window.clearTimeout(packSaveTimer.current)
    packSaveTimer.current = window.setTimeout(() => setPackSaveStatus('idle'), 2000)
  }


  // Drag sources are library samples only. Chops now live in the library as materialized samples
  // (source 'chop'), so listing virtual project chops here too would double them. The projectChops
  // state is still loaded below for stale-pad detection on existing project-chop pack slots.
  const sourceItems = useMemo<PackSourceItem[]>(
    () => samples.map(sampleToSourceItem),
    [samples]
  )

  const samplesById = useMemo(() => new Map(samples.map((s) => [s.id, s])), [samples])

  const filteredSources = useMemo(() => sourceItems.filter((source) => {
    if (search.trim() && !source.displayName.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter !== 'all' && source.sourceType === 'library-sample') {
      const sample = samplesById.get(source.sampleId ?? '')
      if (sample?.source !== sourceFilter) return false
    }
    if (sourceFilter !== 'all' && source.sourceType === 'project-chop') return false
    if (projectFilter === '__none__' && source.projectId !== null) return false
    if (projectFilter && projectFilter !== '__none__' && source.projectId !== projectFilter) return false
    if (bpmFilter !== undefined && (source.bpm === null || Math.abs(source.bpm - bpmFilter) > 5)) return false
    if (keyFilter && source.musicalKey?.toLowerCase() !== keyFilter.toLowerCase()) return false
    return true
  }), [sourceItems, samplesById, search, sourceFilter, projectFilter, bpmFilter, keyFilter])

  // Virtualized source list (callback ref so measurement survives the panel mounting after loads).
  const [sourceScrollTop, setSourceScrollTop] = useState(0)
  const [sourceViewportH, setSourceViewportH] = useState(0)
  const sourceRoRef = useRef<ResizeObserver | null>(null)
  const setSourceScroller = (el: HTMLDivElement | null) => {
    sourceRoRef.current?.disconnect()
    if (!el) return
    setSourceViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => setSourceViewportH(el.clientHeight))
    ro.observe(el)
    sourceRoRef.current = ro
  }
  const sourceTotal = filteredSources.length
  const sourceStart = Math.max(0, Math.floor(sourceScrollTop / SOURCE_ROW_H) - SOURCE_OVERSCAN)
  const sourceEnd = Math.min(sourceTotal, Math.ceil((sourceScrollTop + sourceViewportH) / SOURCE_ROW_H) + SOURCE_OVERSCAN)
  const visibleSources = filteredSources.slice(sourceStart, sourceEnd)

  useEffect(() => {
    fetchPacks()
    fetchSamples().then(() => setSamplesLoaded(true))
    fetchProjects()
    window.api.projects.getAllChops().then(setProjectChops)
  }, [fetchPacks, fetchSamples, fetchProjects])

  useEffect(() => {
    if (!currentPack) return
    loadSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPack?.id])

  const handleDragStart = (event: DragStartEvent) => {
    const source = sourceItems.find((s) => s.id === event.active.id)
    setActiveSource(source ?? null)
    document.body.style.cursor = 'grabbing'
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSource(null)
    document.body.style.cursor = ''
    const { active, over } = event
    if (!over || !currentPack) return
    const slotNumber = Number(over.id)
    const source = sourceItems.find((s) => s.id === active.id)
    if (source !== undefined) {
      setSlot(slotNumber, source)
        .then(flashPackSaved)
        .catch((err) => toast(`Couldn't assign pad: ${err instanceof Error ? err.message : 'unknown error'}`))
    }
  }

  const handleClearSlot = async (slotNumber: number) => {
    await clearSlot(slotNumber)
    flashPackSaved()
  }

  const updateSlotFromSource = async (rec: PadRecovery) => {
    const { slot } = rec
    let source: PackSourceItem | null = null
    if (slot.sourceType === 'project-chop' && slot.projectChopId) {
      const chop = projectChops.find((item) => item.id === slot.projectChopId)
      if (chop?.sourcePath) source = chopToSourceItem(chop)
    } else if (rec.sample) {
      source = sampleToSourceItem(rec.sample)
    }
    if (!source) return
    try {
      await setSlot(slot.slotNumber, source)
      flashPackSaved()
      toast(`${slot.displayName} updated from source`)
    } catch (err) {
      toast(`Couldn't update pad: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const regenerateSlot = async (rec: PadRecovery) => {
    if (!currentPack) return
    try {
      await window.api.packs.regenerateSlotToLibrary(currentPack.id, rec.slotNumber)
      await fetchSamples()
      await loadSlots()
      flashPackSaved()
      toast(`${rec.slot.displayName} regenerated to library`)
    } catch (err) {
      toast(`Couldn't regenerate pad: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const filledSlots = Object.keys(slots).length

  const padRecoveries = Array.from({ length: 16 }, (_, i): PadRecovery | null => {
    const slot = slots[i]
    if (!slot) return null
    // Legacy project-chop pads: drift against the live project chop.
    if (slot.sourceType === 'project-chop') {
      if (!slot.projectChopId) return null
      const chop = projectChops.find((c) => c.id === slot.projectChopId)
      if (!chop || !slot.sourceChopUpdatedAt || chop.updatedAt <= slot.sourceChopUpdatedAt) return null
      return { slotNumber: i, slot, kind: 'drift' }
    }
    // Library-sample pads: today's chop pads are materialized samples.
    if (slot.sourceType === 'library-sample' && slot.sampleId) {
      const sample = samplesById.get(slot.sampleId)
      if (!sample) {
        // Origin chop deleted, so the library sample is gone. Offer to rebuild from owned audio.
        return samplesLoaded && slot.audioPath ? { slotNumber: i, slot, kind: 'orphan' } : null
      }
      if (sample.source === 'chop' && slot.sourceChopUpdatedAt != null && sample.createdAt > slot.sourceChopUpdatedAt) {
        return { slotNumber: i, slot, kind: 'drift', sample }
      }
    }
    return null
  }).filter((r): r is PadRecovery => r !== null)

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex overflow-hidden">

        {/* Sample library panel */}
        <aside className="w-[200px] shrink-0 border-r border-border flex flex-col bg-surface overflow-hidden">
          <div className="px-2 pt-3 pb-2 border-b border-border shrink-0">
            <p className="text-[11px] font-semibold text-faint px-1 pb-2 tracking-wide select-none">Samples</p>
            <FilterControls
              search={search}
              onSearchChange={setSearch}
              source={sourceFilter}
              onSourceChange={setSourceFilter}
              projects={projects}
              projectFilter={projectFilter}
              onProjectFilterChange={setProjectFilter}
              bpm={bpmFilter}
              onBpmChange={setBpmFilter}
              musicalKey={keyFilter}
              onKeyChange={setKeyFilter}
            />
          </div>
          <div
            ref={setSourceScroller}
            className="flex-1 overflow-y-auto py-1 px-1"
            onScroll={(e) => setSourceScrollTop(e.currentTarget.scrollTop)}
          >
            {sourceItems.length === 0 ? (
              <p className="text-faint text-[12px] p-3 leading-relaxed">No sources yet. Create chops or import samples.</p>
            ) : filteredSources.length === 0 ? (
              <p className="text-faint text-[12px] p-3">No matches.</p>
            ) : (
              <div style={{ height: sourceTotal * SOURCE_ROW_H, position: 'relative' }}>
                <div className="flex flex-col gap-px" style={{ transform: `translateY(${sourceStart * SOURCE_ROW_H}px)` }}>
                  {visibleSources.map((source) => (
                    <DraggableSource key={source.id} source={source} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-base">

          {/* Pack toolbar */}
          <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0 bg-surface">
            <div className="flex items-center gap-2">
              {currentPack ? (
                <>
                  <span className="text-[13px] text-ink font-semibold">{currentPack.name}</span>
                  <span className="text-[11px] text-faint font-readout">{filledSlots}/16</span>
                </>
              ) : (
                <span className="text-[13px] text-faint">No pack selected</span>
              )}
              {packSaveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[11px] text-faint/50 select-none">
                  <Check size={10} />
                  Saved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Pad audition mode — preview only, never exported */}
              <Segmented
                size="sm"
                value={padAuditionMode}
                onChange={setPadAuditionMode}
                options={[
                  { value: 'gate', label: 'Gate', title: 'Gate — a pad plays while held, stops on release' },
                  { value: 'oneshot', label: 'One-Shot', title: 'One-Shot — a pad plays the whole chop regardless of release' },
                ]}
              />
              <div className="relative">
                <select
                  value={hardwareProfileId}
                  onChange={(e) => setHardwareProfile(e.target.value)}
                  className="appearance-none bg-raised border border-border rounded-md pl-2.5 pr-5 h-[26px] text-[12px] text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none text-[10px]">▾</span>
              </div>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting || !currentPack || filledSlots === 0}
              >
                <Download size={12} />
                {isExporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </div>

          {/* Pad grid */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            {currentPack ? (
              <>
                <div
                  className="grid grid-cols-4 gap-2.5"
                  style={{ width: 'min(100%, 400px)' }}
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <PadSlot
                      key={i}
                      slotNumber={i}
                      slot={slots[i] ?? null}
                      recovery={padRecoveries.find((r) => r.slotNumber === i)?.kind ?? null}
                      onClear={() => handleClearSlot(i)}
                      isDraggingAny={!!activeSource}
                      auditionMode={padAuditionMode}
                    />
                  ))}
                </div>

                {padRecoveries.length > 0 ? (
                  <div className="border border-border rounded-lg bg-surface overflow-hidden" style={{ width: 'min(100%, 400px)' }}>
                    <div className="px-3 h-8 flex items-center gap-2 border-b border-border">
                      <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
                      <span className="text-[11px] text-muted">
                        {padRecoveries.length === 1 ? '1 pad needs' : `${padRecoveries.length} pads need`} attention
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {padRecoveries.map((rec) => (
                        <div key={rec.slotNumber} className="flex items-center gap-2.5 px-3 h-9">
                          <span className="text-[10px] font-readout text-faint/50 shrink-0 w-4">
                            {String(rec.slotNumber + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[12px] text-ink flex-1 truncate">{rec.slot.displayName}</span>
                          {rec.kind === 'drift' ? (
                            <>
                              <span className="text-[11px] text-faint shrink-0">Source was edited</span>
                              <Button size="sm" onClick={() => updateSlotFromSource(rec)}>
                                <RefreshCw size={10} />
                                Update
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-orange-400/80 shrink-0">Origin removed</span>
                              <Button size="sm" onClick={() => regenerateSlot(rec)}>
                                <RefreshCw size={10} />
                                Regenerate
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-faint/60 select-none">
                    Drag chops or samples from the panel onto pads
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-faint">
                <div className="w-16 h-16 rounded-xl border border-border bg-surface grid grid-cols-2 gap-1.5 p-3 opacity-30">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded bg-raised" />
                  ))}
                </div>
                <p className="text-[13px] text-muted">Select a pack from the sidebar</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeSource && (
          <div className="flex items-center gap-2 px-2 h-[28px] w-[184px] rounded-md text-[12px] text-ink bg-raised shadow-lg shadow-black/40 cursor-grabbing select-none">
            <span className="flex-1 truncate">{activeSource.displayName}</span>
            {activeSource.duration != null && (
              <span className="text-faint tabular-nums shrink-0 font-readout text-[10px]">
                {formatTime(activeSource.duration)}
              </span>
            )}
          </div>
        )}
      </DragOverlay>

    </DndContext>
  )
}

function chopToSourceItem(chop: ProjectChop & { projectName: string; sourcePath: string | null }): PackSourceItem {
  return {
    id: `project-chop:${chop.id}`,
    sourceType: 'project-chop',
    displayName: chop.name,
    sourcePath: chop.sourcePath!,
    projectId: chop.projectId,
    projectName: chop.projectName,
    projectChopId: chop.id,
    sampleId: null,
    start: chop.start,
    end: chop.end,
    duration: chop.end - chop.start,
    bpm: null,
    musicalKey: null,
    tags: [],
    sourceChopUpdatedAt: chop.updatedAt,
  }
}

function sampleToSourceItem(sample: Sample): PackSourceItem {
  return {
    id: `library-sample:${sample.id}`,
    sourceType: 'library-sample',
    displayName: sample.name,
    sourcePath: sample.filePath,
    projectId: sample.projectId,
    projectName: null,
    projectChopId: null,
    sampleId: sample.id,
    start: null,
    end: null,
    duration: sample.duration,
    bpm: sample.bpm,
    musicalKey: sample.musicalKey,
    tags: sample.tags,
    // For chop-materialized samples, capture the sample's build time so the pad can detect when the
    // library re-synced it (refreshChopSample bumps created_at on every re-trim). Plain samples have
    // no upstream to drift from.
    sourceChopUpdatedAt: sample.source === 'chop' ? sample.createdAt : null,
  }
}

function DraggableSource({ source }: { source: PackSourceItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: source.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={undefined}
      className={cn(
        'flex items-center gap-2 px-2 h-[28px] shrink-0 rounded-md text-[12px] text-muted cursor-grab active:cursor-grabbing transition-colors select-none',
        'hover:bg-raised hover:text-ink',
        isDragging && 'opacity-30'
      )}
    >
      <span className="flex-1 truncate">{source.displayName}</span>
      {source.duration != null && (
        <span className="text-faint tabular-nums shrink-0 font-mono text-[10px]">
          {formatTime(source.duration)}
        </span>
      )}
    </div>
  )
}

function MarqueeText({ text }: { text: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:11px;font-weight:500'
    probe.textContent = text
    outer.appendChild(probe)
    const overflows = probe.scrollWidth > outer.clientWidth
    outer.removeChild(probe)
    setIsOverflowing(overflows)
  }, [text])

  return (
    <div ref={outerRef} className="overflow-hidden">
      {isOverflowing ? (
        <div
          className="inline-flex whitespace-nowrap"
          style={{ animation: 'marquee-slide 6s linear infinite' }}
        >
          <span className="text-[11px] font-medium text-ink leading-tight pr-8">{text}</span>
          <span className="text-[11px] font-medium text-ink leading-tight pr-8">{text}</span>
        </div>
      ) : (
        <span className="text-[11px] font-medium text-ink leading-tight block">{text}</span>
      )}
    </div>
  )
}

function PadSlot({ slotNumber, slot, recovery, onClear, isDraggingAny, auditionMode }: {
  slotNumber: number
  slot: PackSlot | null
  recovery: PadRecovery['kind'] | null
  onClear: () => void
  isDraggingAny: boolean
  auditionMode: PadAuditionMode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: slotNumber })
  // Audition the pad's own snapshot (the pre-trimmed owned WAV), so it stays audible even if the
  // source file was moved/deleted and matches exactly what export writes (F13). Legacy pads with no
  // owned audio fall back to trimming the source by region. In Gate, releasing stops; in One-Shot,
  // release is ignored and playback runs to region.end (handled inside useAudioPlayer).
  const auditionPath = slot?.audioPath ?? slot?.sourcePath ?? null
  const region = !slot?.audioPath && slot && slot.start !== null && slot.end !== null ? { start: slot.start, end: slot.end } : null
  const { isPlaying, play, stop } = useAudioPlayer(auditionPath ? toLocalFileUrl(auditionPath) : null, region)
  const releaseStop = auditionMode === 'gate' ? stop : undefined

  const padLabel = String(slotNumber + 1).padStart(2, '0')

  return (
    <div
      ref={setNodeRef}
      onPointerDown={play}
      onPointerUp={releaseStop}
      onPointerLeave={releaseStop}
      className={cn(
        'group relative aspect-square rounded-lg border transition-all overflow-hidden',
        slot
          ? isPlaying
            // Backlit: the pad lights up amber when it sounds. The glow is the signature moment.
            ? 'bg-live/20 border-live/60 shadow-[0_0_18px_rgba(255,179,0,0.38)] scale-[0.97]'
            : 'bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-[rgba(255,255,255,0.025)] border-border hover:border-border-bright hover:from-[rgba(255,255,255,0.09)] hover:to-[rgba(255,255,255,0.04)] cursor-pointer active:scale-[0.97]'
          : 'bg-[rgba(255,255,255,0.02)] border-border/50 hover:border-border',
        isOver && 'border-accent/60 bg-accent/10 scale-[1.02]',
        isDraggingAny && 'cursor-copy',
      )}
    >
      <div className="absolute inset-0 p-2.5 flex flex-col">
        {/* Top row: pad number + clear */}
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] leading-none font-readout', isPlaying ? 'text-live' : slot ? 'text-faint/60' : 'text-faint/30')}>
            {padLabel}
          </span>
          {slot && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="w-5 h-5 flex items-center justify-center text-faint opacity-0 group-hover:opacity-100 hover:text-red-400 rounded bg-transparent border-0 cursor-pointer text-[17px] leading-none transition-opacity"
            >
              ×
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom block */}
        {slot ? (
          <div className="flex flex-col gap-1 min-w-0">
            {/* Upper bottom: scrolling title */}
            <MarqueeText text={slot.displayName} />
            {/* Lower bottom: warning + duration */}
            <div className="flex items-center justify-between">
              <AlertTriangle
                size={12}
                className={cn(
                  'shrink-0',
                  recovery === 'drift' ? 'text-yellow-400' : recovery === 'orphan' ? 'text-orange-400' : 'invisible'
                )}
              />
              {slot.start !== null && slot.end !== null && (
                <span className={cn('text-[10px] font-readout leading-none', isPlaying ? 'text-live/80' : 'text-faint/60')}>
                  {formatTime(slot.end - slot.start)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-faint/20 select-none text-center pb-1">
            {isOver ? '↓' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
