import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Download } from 'lucide-react'
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
  { id: 'maschine-mk3', name: 'Maschine MK3' },
  { id: 'sp404-mkii',   name: 'Roland SP-404 MkII' },
  { id: 'mpc-generic',  name: 'Akai MPC' },
  { id: 'generic',      name: 'Generic WAV' },
  { id: 'daw-folder',   name: 'DAW Folder' },
  { id: 'software-sampler', name: 'Software Sampler' },
]

export default function PacksView() {
  const { currentPack, slots, hardwareProfileId, fetchPacks, setSlot, clearSlot, exportPack, setHardwareProfile, loadSlots } = usePacksStore()
  const { samples, fetchSamples } = useLibraryStore()
  const { projects, activeProject, fetchProjects } = useProjectsStore()
  const { toast } = useToastStore()

  const [activeSource, setActiveSource] = useState<PackSourceItem | null>(null)
  const [projectChops, setProjectChops] = useState<Array<ProjectChop & { projectName: string; sourcePath: string | null }>>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'freesound'>('all')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
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

  const allTags = [...new Set(samples.flatMap((s) => s.tags))].sort()

  const sourceItems: PackSourceItem[] = [
    ...projectChops
      .filter((chop) => chop.sourcePath)
      .map((chop) => ({
        id: `project-chop:${chop.id}`,
        sourceType: 'project-chop' as const,
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
      })),
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
    if (activeTags.length && !activeTags.some((t) => source.tags.includes(t))) return false
    if (bpmFilter !== undefined && (source.bpm === null || Math.abs(source.bpm - bpmFilter) > 5)) return false
    if (keyFilter && source.musicalKey?.toLowerCase() !== keyFilter.toLowerCase()) return false
    return true
  })

  const currentProjectSources = filteredSources.filter((source) => source.sourceType === 'project-chop' && source.projectId === activeProject?.id)
  const otherProjectSources = filteredSources.filter((source) => source.sourceType === 'project-chop' && source.projectId !== activeProject?.id)
  const librarySources = filteredSources.filter((source) => source.sourceType === 'library-sample')

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])

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
    if (source !== undefined) setSlot(slotNumber, source)
  }

  const filledSlots = Object.keys(slots).length

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
              allTags={allTags}
              activeTags={activeTags}
              onTagToggle={toggleTag}
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
              <>
                <SourceSection label="Current Project" sources={currentProjectSources} />
                <SourceSection label="Other Projects" sources={otherProjectSources} />
                <SourceSection label="Library" sources={librarySources} />
              </>
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
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
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
                      onClear={() => clearSlot(i)}
                      isDraggingAny={!!activeSource}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-faint/60 select-none">
                  Drag chops or samples from the panel onto pads
                </p>
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
      <DragOverlay>
        {activeSource && (
          <div className="bg-overlay border border-accent/40 rounded px-3 py-2 text-xs text-ink shadow-xl shadow-black/50 opacity-95" style={{ cursor: 'grabbing' }}>
            {activeSource.displayName}
          </div>
        )}
      </DragOverlay>

    </DndContext>
  )
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

function SourceSection({ label, sources }: { label: string; sources: PackSourceItem[] }) {
  if (sources.length === 0) return null
  return (
    <div className="flex flex-col gap-px">
      <p className="px-2 pt-2 pb-1 text-[10px] font-semibold text-faint/70 tracking-wide select-none">{label}</p>
      {sources.map((source) => (
        <DraggableSource key={source.id} source={source} />
      ))}
    </div>
  )
}

function DraggableSource({ source }: { source: PackSourceItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: source.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: isDragging ? undefined : CSS.Translate.toString(transform) }}
      className={cn(
        'flex items-center gap-2 px-2 h-[28px] rounded-md text-[12px] text-muted cursor-grab active:cursor-grabbing transition-colors select-none',
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

function PadSlot({ slotNumber, slot, onClear, isDraggingAny }: {
  slotNumber: number
  slot: PackSlot | null
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
      <div className="absolute inset-0 p-2.5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className={cn('text-[10px] tabular-nums leading-none font-mono', slot ? 'text-faint/60' : 'text-faint/30')}>
            {padLabel}
          </span>
          {slot && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="w-4 h-4 flex items-center justify-center text-faint hover:text-red-400 rounded-sm bg-transparent border-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-[13px] leading-none"
            >
              ×
            </button>
          )}
        </div>

        {slot ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[11px] font-medium text-ink leading-tight truncate">{slot.displayName}</p>
            {slot.start !== null && slot.end !== null && (
              <p className="text-[10px] text-faint/60 tabular-nums font-mono">
                {formatTime(slot.end - slot.start)}
              </p>
            )}
          </div>
        ) : (
          <div className="self-center text-[11px] text-faint/20 select-none">
            {isOver ? '↓' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
