import { useEffect, useRef, useState } from 'react'
import { Search, Trash2, Play, Square } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import type { Sample } from '@/types'

export default function LibraryView() {
  const { samples, searchQuery, isLoading, fetchSamples, deleteSample, setSearchQuery } = useLibraryStore()
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

    if (audioRef.current) {
      audioRef.current.pause()
    }

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
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Search */}
      <div className="relative shrink-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search samples…"
          className="w-full max-w-sm bg-white/5 border border-white/10 rounded pl-9 pr-3 h-9 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/60 transition-colors"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/30">
          <p className="text-sm">{searchQuery ? 'No samples match your search.' : 'No samples yet.'}</p>
          {!searchQuery && <p className="text-xs">Chop some audio and click "Save to Library".</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {filtered.map((sample) => (
              <SampleCard
                key={sample.id}
                sample={sample}
                isPlaying={playingId === sample.id}
                onPlayToggle={() => togglePlay(sample)}
                onDelete={(e) => handleDelete(sample, e)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-white/20 text-xs shrink-0">
        {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
      </p>
    </div>
  )
}

function SampleCard({
  sample,
  isPlaying,
  onPlayToggle,
  onDelete,
}: {
  sample: Sample
  isPlaying: boolean
  onPlayToggle: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={cn(
        'group relative bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col gap-2',
        'hover:bg-white/8 hover:border-white/20 transition-colors cursor-pointer',
        isPlaying && 'border-sky-500/40 bg-sky-500/5'
      )}
      onClick={onPlayToggle}
    >
      {/* Play indicator */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
        isPlaying ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-white/40 group-hover:text-white/60'
      )}>
        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 font-medium truncate">{sample.name}</p>
        <p className="text-xs text-white/30 mt-0.5">
          {sample.duration != null ? formatTime(sample.duration) : '—'}
          {sample.bpm != null && <span className="ml-2">{Math.round(sample.bpm)} BPM</span>}
        </p>
      </div>

      <button
        onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 bg-transparent border-0 p-1 cursor-pointer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
