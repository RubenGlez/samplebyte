import { useEffect, useRef, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Search, ChevronDown, Download, FolderOpen } from 'lucide-react'
import { usePacksStore } from '@/stores/packs'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import { Button } from '@/components/ui/Button'
import type { Sample } from '@/types'

const PROFILES = [
  { id: 'maschine-mk3', name: 'Maschine MK3' },
  { id: 'sp404-mkii',   name: 'Roland SP-404 MkII' },
  { id: 'mpc-generic',  name: 'Akai MPC' },
  { id: 'generic',      name: 'Generic WAV' },
]

export default function PacksView() {
  const { currentPack, slots, hardwareProfileId, fetchPacks, setSlot, clearSlot, exportPack, setHardwareProfile, initSlots } = usePacksStore()
  const { samples, fetchSamples } = useLibraryStore()
  const { projects } = useProjectsStore()
  const { toast } = useToastStore()

  const [activeSample, setActiveSample] = useState<Sample | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'freesound'>('all')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
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

  const filteredSamples = samples.filter((s) => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false
    if (projectFilter === '__none__' && s.projectId !== null) return false
    if (projectFilter && projectFilter !== '__none__' && s.projectId !== projectFilter) return false
    if (activeTags.length && !activeTags.some((t) => s.tags.includes(t))) return false
    return true
  })

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])

  useEffect(() => {
    fetchPacks()
    fetchSamples()
  }, [fetchPacks, fetchSamples])

  useEffect(() => {
    if (!currentPack || samples.length === 0) return
    window.api.packs.getSlots(currentPack.id).then((packSlots) => {
      const resolved: Record<number, Sample> = {}
      for (const slot of packSlots) {
        const sample = samples.find((s) => s.id === slot.sampleId)
        if (sample) resolved[slot.slotNumber] = sample
      }
      initSlots(resolved)
    })
  }, [currentPack?.id, samples.length])

  const handleDragStart = (event: DragStartEvent) => {
    const sample = samples.find((s) => s.id === event.active.id)
    setActiveSample(sample ?? null)
    document.body.style.cursor = 'grabbing'
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSample(null)
    document.body.style.cursor = ''
    const { active, over } = event
    if (!over || !currentPack) return
    const slotNumber = Number(over.id)
    const sample = samples.find((s) => s.id === active.id)
    if (sample !== undefined) setSlot(slotNumber, sample)
  }

  const filledSlots = Object.keys(slots).length

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex overflow-hidden">

        {/* Library sidebar */}
        <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-surface overflow-hidden">
          <div className="flex flex-col gap-2 px-2 pt-2 pb-2 border-b border-border shrink-0">
            {/* Search */}
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-raised border border-border rounded pl-7 pr-2 h-7 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            {/* Source filter */}
            <div className="flex gap-1">
              {(['all', 'local', 'freesound'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    'flex-1 h-6 rounded text-[10px] font-medium transition-colors bg-transparent border cursor-pointer capitalize',
                    sourceFilter === s
                      ? 'border-accent/40 text-accent bg-accent/10'
                      : 'border-border text-faint hover:text-muted hover:border-border-bright'
                  )}
                  style={{ fontFamily: 'var(--font-family-brand)' }}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Project filter */}
            {projects.length > 0 && (
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
            )}
            {/* Tag filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer border bg-transparent',
                      activeTags.includes(tag)
                        ? 'border-accent/40 text-accent bg-accent/10'
                        : 'border-border text-faint hover:text-muted hover:border-border-bright'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
            {samples.length === 0 ? (
              <p className="text-faint text-xs p-3 leading-relaxed">No samples yet. Save some chops first.</p>
            ) : filteredSamples.length === 0 ? (
              <p className="text-faint text-xs p-3">No matches.</p>
            ) : (
              filteredSamples.map((sample) => (
                <DraggableSample key={sample.id} sample={sample} />
              ))
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-base">

          {/* Toolbar */}
          <div className="h-11 flex items-center justify-between px-5 border-b border-border shrink-0 bg-surface">
            <div className="flex items-center gap-2">
              {currentPack ? (
                <>
                  <span className="text-sm text-ink font-medium">{currentPack.name}</span>
                  <span className="text-[11px] text-faint" style={{ fontFamily: 'var(--font-family-mono)' }}>
                    {filledSlots}/16
                  </span>
                </>
              ) : (
                <span className="text-sm text-faint">No pack selected</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={hardwareProfileId}
                  onChange={(e) => setHardwareProfile(e.target.value)}
                  className="appearance-none bg-raised border border-border rounded pl-2.5 pr-6 h-7 text-xs text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
                >
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              </div>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting || !currentPack || filledSlots === 0}
              >
                <Download size={13} />
                {isExporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </div>

          {/* Pad grid */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            {currentPack ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <p
                    className="text-xs text-faint tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-family-brand)' }}
                  >
                    {currentPack.name}
                  </p>
                  <span className="text-[10px] text-faint/60" style={{ fontFamily: 'var(--font-family-mono)' }}>
                    {filledSlots}/16
                  </span>
                </div>
                <div
                  className="grid grid-cols-4 gap-2"
                  style={{ width: 'min(100%, 420px)' }}
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <PadSlot
                      key={i}
                      slotNumber={i}
                      sample={slots[i] ?? null}
                      onClear={() => clearSlot(i)}
                      isDraggingAny={!!activeSample}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-faint mt-2">
                  Drag samples from the library onto pads
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-faint">
                <div className="w-16 h-16 rounded-xl border border-border bg-surface grid grid-cols-2 gap-1 p-2 opacity-40">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-sm bg-raised" />
                  ))}
                </div>
                <p className="text-sm text-muted">Select a pack from the sidebar</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeSample && (
          <div className="bg-overlay border border-accent/40 rounded px-3 py-2 text-xs text-ink shadow-xl shadow-black/50 opacity-95" style={{ cursor: 'grabbing' }}>
            {activeSample.name}
          </div>
        )}
      </DragOverlay>

    </DndContext>
  )
}

function DraggableSample({ sample }: { sample: Sample }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sample.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: isDragging ? undefined : CSS.Translate.toString(transform) }}
      className={cn(
        'flex items-center gap-2 px-3 py-1 rounded text-xs text-muted cursor-grab active:cursor-grabbing transition-colors select-none',
        'hover:bg-raised hover:text-ink',
        isDragging && 'opacity-30'
      )}
    >
      <span className="flex-1 truncate font-medium">{sample.name}</span>
      {sample.duration != null && (
        <span
          className="text-faint tabular-nums shrink-0"
          style={{ fontFamily: 'var(--font-family-mono)', fontSize: '10px' }}
        >
          {formatTime(sample.duration)}
        </span>
      )}
    </div>
  )
}

function PadSlot({ slotNumber, sample, onClear, isDraggingAny }: { slotNumber: number; sample: Sample | null; onClear: () => void; isDraggingAny: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: slotNumber })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePadPress = () => {
    if (!sample) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    const audio = new Audio(`local-file://${sample.filePath}`)
    audio.onended = () => setIsPlaying(false)
    audio.play()
    audioRef.current = audio
    setIsPlaying(true)
  }

  const handlePadRelease = () => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
  }

  const padLabel = String(slotNumber + 1).padStart(2, '0')

  return (
    // Outer div owns the square shape only — no padding/flex so content can't stretch it
    <div
      ref={setNodeRef}
      onPointerDown={handlePadPress}
      onPointerUp={handlePadRelease}
      onPointerLeave={handlePadRelease}
      className={cn(
        'relative aspect-square rounded-lg border transition-all overflow-hidden',
        sample
          ? isPlaying
            ? 'bg-accent/20 border-accent/60 scale-[0.97]'
            : 'bg-accent/8 border-accent/25 hover:bg-accent/12 hover:border-accent/40 cursor-pointer active:scale-[0.97]'
          : 'bg-[#0E0C09] border-[rgba(255,180,100,0.06)] hover:border-border',
        isOver && 'border-accent/50 bg-accent/12 scale-[1.02]',
        isDraggingAny && 'cursor-copy',
      )}
    >
      {/* All content is absolutely positioned so it can never stretch the square */}
      <div className="absolute inset-0 p-2.5 flex flex-col justify-between">
        {/* Top row: pad number + accent dot / clear */}
        <div className="flex items-start justify-between">
          <span
            className={cn('text-[10px] tabular-nums leading-none', sample ? 'text-accent/40' : 'text-faint/60')}
            style={{ fontFamily: 'var(--font-family-mono)' }}
          >
            {padLabel}
          </span>
          {sample && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="w-4 h-4 flex items-center justify-center text-faint hover:text-red-400 rounded bg-transparent border-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-xs leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Bottom: sample info or empty hint */}
        {sample ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[11px] font-medium text-ink leading-tight truncate">{sample.name}</p>
            {sample.duration != null && (
              <p className="text-[10px] text-accent/50 tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>
                {formatTime(sample.duration)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-faint/30 self-center">
            {isOver ? '↓' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
