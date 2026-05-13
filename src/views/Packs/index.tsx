import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Download, ChevronDown } from 'lucide-react'
import { usePacksStore } from '@/stores/packs'
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
  const { packs, currentPack, slots, hardwareProfileId, fetchPacks, createPack, setCurrentPack, setSlot, clearSlot, setHardwareProfile, exportPack } = usePacksStore()
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
      alert(`Exported ${result.filesWritten} files to ${outputDir}`)
    } finally {
      setIsExporting(false)
    }
  }

  const profile = PROFILES.find((p) => p.id === hardwareProfileId) ?? PROFILES[0]

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex overflow-hidden">

        {/* Library sidebar */}
        <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Library</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {samples.length === 0 ? (
              <p className="text-white/20 text-xs p-2">No samples yet. Save some chops first.</p>
            ) : (
              samples.map((sample) => (
                <DraggableSample key={sample.id} sample={sample} />
              ))
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-white/10 shrink-0">
            {/* Pack selector */}
            <div className="flex items-center gap-2 flex-1">
              <select
                value={currentPack?.id ?? ''}
                onChange={(e) => {
                  const pack = packs.find((p) => p.id === e.target.value)
                  setCurrentPack(pack ?? null)
                }}
                className="bg-white/5 border border-white/10 rounded px-3 h-8 text-sm text-white focus:outline-none focus:border-sky-500/60 cursor-pointer"
              >
                <option value="" disabled>Select a pack…</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <Button variant="ghost" size="icon" onClick={() => setShowNewPack(true)} title="New pack">
                <Plus size={14} />
              </Button>
            </div>

            {/* Profile selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Target:</span>
              <div className="relative">
                <select
                  value={hardwareProfileId}
                  onChange={(e) => setHardwareProfile(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 rounded pl-3 pr-7 h-8 text-sm text-white focus:outline-none focus:border-sky-500/60 cursor-pointer"
                >
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
            </div>

            <Button size="sm" onClick={handleExport} disabled={isExporting || !currentPack || Object.keys(slots).length === 0}>
              <Download size={14} />
              {isExporting ? 'Exporting…' : `Export ${profile.name}`}
            </Button>
          </div>

          {/* Pad grid */}
          <div className="flex-1 flex items-center justify-center p-8">
            {currentPack ? (
              <div className="grid grid-cols-4 gap-3" style={{ width: 'min(100%, 480px)' }}>
                {Array.from({ length: 16 }, (_, i) => (
                  <PadSlot key={i} slotNumber={i} sample={slots[i] ?? null} onClear={() => clearSlot(i)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/30">
                <p className="text-sm">No pack selected.</p>
                <Button variant="ghost" size="sm" onClick={() => setShowNewPack(true)}>
                  <Plus size={14} /> Create a pack
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeSample && (
          <div className="bg-slate-800 border border-sky-500/40 rounded px-3 py-2 text-sm text-white shadow-xl opacity-90">
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
          <div className="flex justify-end gap-3 mt-4">
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
        'px-3 py-2 rounded text-sm text-white/70 cursor-grab active:cursor-grabbing',
        'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors',
        isDragging && 'opacity-30'
      )}
    >
      <p className="truncate">{sample.name}</p>
      {sample.duration != null && (
        <p className="text-xs text-white/30 mt-0.5">{formatTime(sample.duration)}</p>
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
        'relative aspect-square rounded-lg border transition-colors flex flex-col items-center justify-center p-2 text-center',
        sample
          ? 'bg-sky-500/10 border-sky-500/30 text-white'
          : 'bg-white/3 border-white/10 text-white/20',
        isOver && 'border-sky-400/60 bg-sky-400/15',
      )}
    >
      <span className="absolute top-1.5 left-2 text-[10px] text-white/20 tabular-nums">{padLabel}</span>

      {sample ? (
        <>
          <p className="text-xs font-medium leading-tight line-clamp-2">{sample.name}</p>
          {sample.duration != null && (
            <p className="text-[10px] text-white/40 mt-1">{formatTime(sample.duration)}</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="absolute top-1 right-1.5 text-white/20 hover:text-red-400 bg-transparent border-0 text-xs cursor-pointer leading-none"
          >
            ×
          </button>
        </>
      ) : (
        <span className="text-[10px]">drop here</span>
      )}
    </div>
  )
}
