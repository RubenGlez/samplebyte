import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { AlertTriangle, Check, Download, RefreshCw } from 'lucide-react'
import { usePacksStore } from '@/stores/packs'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { FilterControls } from '@/components/FilterControls'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import { Button } from '@/components/ui/Button'
import type { PackSlot, PackSourceItem, ProjectChop, Sample } from '@/types'

const PROFILES = [
  { id: 'sp404-mkii',  name: 'Roland SP-404 MkII' },
  { id: 'mpc-generic', name: 'Akai MPC One' },
  { id: 'maschine-mk3', name: 'Maschine MK3' },
  { id: 'generic',     name: 'Generic WAV' },
]

export default function PacksView() {
  const { currentPack, slots, hardwareProfileId, fetchPacks, setSlot, clearSlot, exportPack, setHardwareProfile, loadSlots } = usePacksStore()
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

  const handleExport = async () => {
    if (!currentPack) return
    const outputDir = await window.api.fs.pickFolder()
    if (!outputDir) return
    setIsExporting(true)
    try {
      const result = await exportPack(outputDir)
      toast(`${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} exported`)
    } finally {
      setIsExporting(false)
    }
  }

  const flashPackSaved = () => {
    setPackSaveStatus('saved')
    if (packSaveTimer.current !== null) window.clearTimeout(packSaveTimer.current)
    packSaveTimer.current = window.setTimeout(() => setPackSaveStatus('idle'), 2000)
  }


  const sourceItems: PackSourceItem[] = [
    ...projectChops
      .filter((chop) => chop.sourcePath)
      .map(chopToSourceItem),
    ...samples.map(sampleToSourceItem),
  ]

  const filteredSources = sourceItems.filter((source) => {
    if (search.trim() && !source.displayName.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter !== 'all' && source.sourceType === 'library-sample') {
      const sample = samples.find((s) => s.id === source.sampleId)
      if (sample?.source !== sourceFilter) return false
    }
    if (sourceFilter !== 'all' && source.sourceType === 'project-chop') return false
    if (projectFilter === '__none__' && source.projectId !== null) return false
    if (projectFilter && projectFilter !== '__none__' && source.projectId !== projectFilter) return false
    if (bpmFilter !== undefined && (source.bpm === null || Math.abs(source.bpm - bpmFilter) > 5)) return false
    if (keyFilter && source.musicalKey?.toLowerCase() !== keyFilter.toLowerCase()) return false
    return true
  })

  useEffect(() => {
    fetchPacks()
    fetchSamples()
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
    if (source !== undefined) setSlot(slotNumber, source).then(flashPackSaved)
  }

  const handleClearSlot = async (slotNumber: number) => {
    await clearSlot(slotNumber)
    flashPackSaved()
  }

  const refreshSlotFromSource = async (slot: PackSlot) => {
    if (!slot.projectChopId) return
    const chop = projectChops.find((item) => item.id === slot.projectChopId)
    if (!chop?.sourcePath) return
    await setSlot(slot.slotNumber, chopToSourceItem(chop))
    flashPackSaved()
    toast(`${chop.name} refreshed from source`)
  }

  const filledSlots = Object.keys(slots).length

  const stalePads = Array.from({ length: 16 }, (_, i) => {
    const slot = slots[i]
    if (!slot?.projectChopId) return null
    const chop = projectChops.find((c) => c.id === slot.projectChopId)
    if (!chop || !slot.sourceChopUpdatedAt || chop.updatedAt <= slot.sourceChopUpdatedAt) return null
    return { slotNumber: i, slot, chop }
  }).filter(Boolean) as Array<{ slotNumber: number; slot: PackSlot; chop: ProjectChop & { projectName: string; sourcePath: string | null } }>

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
          <div className="flex-1 overflow-y-auto py-1 px-1 flex flex-col gap-px">
            {sourceItems.length === 0 ? (
              <p className="text-faint text-[12px] p-3 leading-relaxed">No sources yet. Create chops or import samples.</p>
            ) : filteredSources.length === 0 ? (
              <p className="text-faint text-[12px] p-3">No matches.</p>
            ) : (
              filteredSources.map((source) => (
                <DraggableSource key={source.id} source={source} />
              ))
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
                  <span className="text-[11px] text-faint font-mono">{filledSlots}/16</span>
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
              <div className="relative">
                <select
                  value={hardwareProfileId}
                  onChange={(e) => setHardwareProfile(e.target.value)}
                  className="appearance-none bg-raised border border-border rounded-md pl-2.5 pr-5 h-[26px] text-[12px] text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
                >
                  {PROFILES.map((p) => (
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
                      sourceChanged={stalePads.some((s) => s.slotNumber === i)}
                      onClear={() => handleClearSlot(i)}
                      isDraggingAny={!!activeSource}
                    />
                  ))}
                </div>

                {stalePads.length > 0 ? (
                  <div className="border border-border rounded-lg bg-surface overflow-hidden" style={{ width: 'min(100%, 400px)' }}>
                    <div className="px-3 h-8 flex items-center gap-2 border-b border-border">
                      <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
                      <span className="text-[11px] text-muted">
                        {stalePads.length === 1 ? '1 pad has' : `${stalePads.length} pads have`} an updated source
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {stalePads.map(({ slotNumber, slot }) => (
                        <div key={slotNumber} className="flex items-center gap-2.5 px-3 h-9">
                          <span className="text-[10px] font-mono text-faint/50 shrink-0 w-4">
                            {String(slotNumber + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[12px] text-ink flex-1 truncate">{slot.displayName}</span>
                          <span className="text-[11px] text-faint shrink-0">Source was edited</span>
                          <Button size="sm" onClick={() => refreshSlotFromSource(slot)}>
                            <RefreshCw size={10} />
                            Refresh
                          </Button>
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
              <span className="text-faint tabular-nums shrink-0 font-mono text-[10px]">
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
    sourceChopUpdatedAt: null,
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

function PadSlot({ slotNumber, slot, sourceChanged, onClear, isDraggingAny }: {
  slotNumber: number
  slot: PackSlot | null
  sourceChanged: boolean
  onClear: () => void
  isDraggingAny: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: slotNumber })
  const { isPlaying, play, stop } = useAudioPlayer(slot ? toLocalFileUrl(slot.sourcePath) : null)

  const padLabel = String(slotNumber + 1).padStart(2, '0')

  return (
    <div
      ref={setNodeRef}
      onPointerDown={play}
      onPointerUp={stop}
      onPointerLeave={stop}
      className={cn(
        'group relative aspect-square rounded-lg border transition-all overflow-hidden',
        slot
          ? isPlaying
            ? 'bg-accent/20 border-accent/50 scale-[0.97]'
            : 'bg-[rgba(255,255,255,0.04)] border-border hover:border-border-bright hover:bg-[rgba(255,255,255,0.06)] cursor-pointer active:scale-[0.97]'
          : 'bg-[rgba(255,255,255,0.02)] border-border/50 hover:border-border',
        isOver && 'border-accent/50 bg-accent/10 scale-[1.02]',
        isDraggingAny && 'cursor-copy',
      )}
    >
      <div className="absolute inset-0 p-2.5 flex flex-col">
        {/* Top row: pad number + clear */}
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] tabular-nums leading-none font-mono', slot ? 'text-faint/60' : 'text-faint/30')}>
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
                className={cn('shrink-0', sourceChanged ? 'text-yellow-400' : 'invisible')}
              />
              {slot.start !== null && slot.end !== null && (
                <span className="text-[10px] text-faint/60 tabular-nums font-mono leading-none">
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
