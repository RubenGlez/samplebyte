import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Download, ChevronDown, Trash2 } from 'lucide-react'
import { usePacksStore } from '@/stores/packs'
import { useToastStore } from '@/stores/toast'
import { useLibraryStore } from '@/stores/library'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Sample } from '@/types'

const PROFILES = [
  { id: 'maschine-mk3', name: 'Maschine MK3' },
  { id: 'sp404-mkii',   name: 'Roland SP-404 MkII' },
  { id: 'mpc-generic',  name: 'Akai MPC' },
  { id: 'generic',      name: 'Generic WAV' },
]

export default function PacksView() {
  const { packs, currentPack, slots, hardwareProfileId, fetchPacks, createPack, setCurrentPack, setSlot, clearSlot, setHardwareProfile, exportPack, deletePack } = usePacksStore()
  const { toast } = useToastStore()
  const { samples, fetchSamples } = useLibraryStore()

  const [showNewPack, setShowNewPack] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [activeSample, setActiveSample] = useState<Sample | null>(null)

  useEffect(() => {
    fetchPacks()
    fetchSamples()
  }, [fetchPacks, fetchSamples])

  const handleCreatePack = async () => {
    if (!newPackName.trim()) return
    await createPack(newPackName.trim(), hardwareProfileId)
    setNewPackName('')
    setShowNewPack(false)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const sample = samples.find((s) => s.id === event.active.id)
    setActiveSample(sample ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSample(null)
    const { active, over } = event
    if (!over || !currentPack) return
    const slotNumber = Number(over.id)
    const sample = samples.find((s) => s.id === active.id)
    if (sample !== undefined) setSlot(slotNumber, sample)
  }

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

  const handleDeletePack = async () => {
    if (!currentPack) return
    if (!confirm(`Delete pack "${currentPack.name}"?`)) return
    await deletePack(currentPack.id)
    toast('Pack deleted')
  }

  const profile = PROFILES.find((p) => p.id === hardwareProfileId) ?? PROFILES[0]
  const filledSlots = Object.keys(slots).length

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex overflow-hidden">

        {/* Library sidebar */}
        <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p
              className="text-[10px] text-faint font-medium uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-family-brand)' }}
            >
              Library
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
            {samples.length === 0 ? (
              <p className="text-faint text-xs p-3 leading-relaxed">No samples yet. Save some chops first.</p>
            ) : (
              samples.map((sample) => (
                <DraggableSample key={sample.id} sample={sample} />
              ))
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-base">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-surface">
            <div className="flex items-center gap-2 flex-1">
              <select
                value={currentPack?.id ?? ''}
                onChange={(e) => {
                  const pack = packs.find((p) => p.id === e.target.value)
                  setCurrentPack(pack ?? null)
                }}
                className="bg-base border border-border rounded px-3 h-8 text-sm text-ink focus:outline-none focus:border-accent/40 cursor-pointer appearance-none"
              >
                <option value="" disabled>Select a pack…</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button variant="ghost" size="icon" onClick={() => setShowNewPack(true)} title="New pack">
                <Plus size={13} />
              </Button>
              {currentPack && (
                <Button variant="danger" size="icon" onClick={handleDeletePack} title="Delete pack">
                  <Trash2 size={13} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-faint" style={{ fontFamily: 'var(--font-family-brand)' }}>Target</span>
              <div className="relative">
                <select
                  value={hardwareProfileId}
                  onChange={(e) => setHardwareProfile(e.target.value)}
                  className="appearance-none bg-base border border-border rounded pl-3 pr-7 h-8 text-sm text-ink focus:outline-none focus:border-accent/40 cursor-pointer"
                >
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleExport}
              disabled={isExporting || !currentPack || filledSlots === 0}
            >
              <Download size={13} />
              {isExporting ? 'Exporting…' : `Export`}
            </Button>
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
                    />
                  ))}
                </div>
                <p className="text-[10px] text-faint mt-2">
                  {profile.name} · Drag samples from the library onto pads
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-faint">
                <div className="w-16 h-16 rounded-xl border border-border bg-surface grid grid-cols-2 gap-1 p-2 opacity-40">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-sm bg-raised" />
                  ))}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-muted">No pack selected</p>
                  <p className="text-xs text-faint">Create a pack to start loading samples</p>
                </div>
                <Button size="sm" onClick={() => setShowNewPack(true)}>
                  <Plus size={13} /> New Pack
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeSample && (
          <div className="bg-overlay border border-accent/40 rounded px-3 py-2 text-xs text-ink shadow-xl shadow-black/50 opacity-95">
            {activeSample.name}
          </div>
        )}
      </DragOverlay>

      {/* New pack dialog */}
      <Dialog open={showNewPack} onOpenChange={setShowNewPack}>
        <DialogContent>
          <DialogTitle>New Pack</DialogTitle>
          <Input
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            placeholder="Pack name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreatePack()}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleCreatePack} disabled={!newPackName.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'px-3 py-2 rounded text-xs text-muted cursor-grab active:cursor-grabbing transition-colors select-none',
        'hover:bg-raised hover:text-ink',
        isDragging && 'opacity-30'
      )}
    >
      <p className="truncate font-medium">{sample.name}</p>
      {sample.duration != null && (
        <p
          className="text-faint mt-0.5 tabular-nums"
          style={{ fontFamily: 'var(--font-family-mono)', fontSize: '10px' }}
        >
          {formatTime(sample.duration)}
        </p>
      )}
    </div>
  )
}

function PadSlot({ slotNumber, sample, onClear }: { slotNumber: number; sample: Sample | null; onClear: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: slotNumber })

  const padLabel = String(slotNumber + 1).padStart(2, '0')

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative aspect-square rounded-lg border transition-all flex flex-col items-start justify-end p-2.5',
        sample
          ? 'bg-accent/8 border-accent/25 shadow-[inset_0_1px_0_rgba(255,180,100,0.08)]'
          : 'bg-[#0E0C09] border-[rgba(255,180,100,0.06)] hover:border-border',
        isOver && 'border-accent/50 bg-accent/12 scale-[1.02]',
      )}
    >
      {/* Pad number */}
      <span
        className={cn(
          'absolute top-2 left-2.5 text-[10px] tabular-nums leading-none',
          sample ? 'text-accent/40' : 'text-faint/60'
        )}
        style={{ fontFamily: 'var(--font-family-mono)' }}
      >
        {padLabel}
      </span>

      {sample ? (
        <>
          {/* Filled pad */}
          <div className="flex flex-col gap-1 w-full">
            <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2 break-all">{sample.name}</p>
            {sample.duration != null && (
              <p
                className="text-[10px] text-accent/50 tabular-nums"
                style={{ fontFamily: 'var(--font-family-mono)' }}
              >
                {formatTime(sample.duration)}
              </p>
            )}
          </div>
          {/* Orange corner accent */}
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent/60" />
          {/* Clear button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-faint hover:text-red-400 hover:bg-red-500/10 rounded bg-transparent border-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-xs leading-none"
            style={{ top: 6, right: 6 }}
          >
            ×
          </button>
        </>
      ) : (
        <span className="text-[9px] text-faint/40 leading-none w-full text-center absolute inset-0 flex items-center justify-center">
          {isOver ? '↓' : '·'}
        </span>
      )}
    </div>
  )
}
