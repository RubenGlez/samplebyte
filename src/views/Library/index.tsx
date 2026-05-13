import { useEffect, useRef, useState } from 'react'
import { Search, Trash2, Play, Square, Pencil } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useToastStore } from '@/stores/toast'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import type { Sample } from '@/types'

export default function LibraryView() {
  const { samples, searchQuery, isLoading, fetchSamples, deleteSample, updateSample, setSearchQuery } = useLibraryStore()
  const { toast } = useToastStore()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchSamples()
  }, [fetchSamples])

  const filtered = samples.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const togglePlay = (sample: Sample) => {
    if (playingId === sample.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(`local-file://${sample.filePath}`)
    audio.onended = () => setPlayingId(null)
    audio.play()
    audioRef.current = audio
    setPlayingId(sample.id)
  }

  const handleDelete = async (sample: Sample, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${sample.name}"?`)) return
    if (playingId === sample.id) {
      audioRef.current?.pause()
      setPlayingId(null)
    }
    await deleteSample(sample.id)
    toast('Sample deleted', 'info')
  }

  const handleRename = async (sample: Sample, name: string) => {
    if (!name.trim() || name === sample.name) return
    await updateSample(sample.id, { name: name.trim() })
    toast('Sample renamed')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search samples…"
            className="w-full bg-surface border border-border rounded pl-9 pr-3 h-8 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
        <span className="text-xs text-faint ml-auto" style={{ fontFamily: 'var(--font-family-mono)' }}>
          {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-faint text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-faint">
          <p className="text-sm">{searchQuery ? 'No samples match your search.' : 'No samples yet.'}</p>
          {!searchQuery && <p className="text-xs text-faint/70">Chop some audio and save to Library.</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {filtered.map((sample) => (
              <SampleCard
                key={sample.id}
                sample={sample}
                isPlaying={playingId === sample.id}
                onPlayToggle={() => togglePlay(sample)}
                onDelete={(e) => handleDelete(sample, e)}
                onRename={(name) => handleRename(sample, name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SampleCard({
  sample,
  isPlaying,
  onPlayToggle,
  onDelete,
  onRename,
}: {
  sample: Sample
  isPlaying: boolean
  onPlayToggle: () => void
  onDelete: (e: React.MouseEvent) => void
  onRename: (name: string) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(sample.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitRename = () => {
    setIsRenaming(false)
    onRename(draftName)
  }

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftName(sample.name)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  return (
    <div
      className={cn(
        'group relative bg-surface border rounded-lg p-4 flex flex-col gap-3 cursor-pointer transition-all',
        isPlaying
          ? 'border-accent/30 bg-accent/5'
          : 'border-border hover:border-border-bright hover:bg-raised'
      )}
      onClick={onPlayToggle}
    >
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0',
        isPlaying
          ? 'bg-accent text-[#0A0806]'
          : 'bg-raised border border-border text-faint group-hover:border-border-bright group-hover:text-muted'
      )}>
        {isPlaying
          ? <Square size={10} fill="currentColor" />
          : <Play   size={10} fill="currentColor" />
        }
      </div>

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsRenaming(false)
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent border-0 border-b border-accent/50 outline-none text-sm text-ink font-medium py-0 px-0"
            autoFocus
          />
        ) : (
          <p className="text-sm text-ink font-medium truncate leading-tight">{sample.name}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {sample.duration != null && (
            <span className="text-[11px] text-faint tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>
              {formatTime(sample.duration)}
            </span>
          )}
          {sample.bpm != null && (
            <span className="text-[10px] text-accent/70 tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>
              {Math.round(sample.bpm)} BPM
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-red-400 bg-transparent border-0 p-1 cursor-pointer rounded"
      >
        <Trash2 size={11} />
      </button>

      <button
        onClick={startRename}
        className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer rounded"
        title="Rename"
      >
        <Pencil size={11} />
      </button>

      {isPlaying && (
        <span className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      )}
    </div>
  )
}
