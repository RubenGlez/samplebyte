import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'

export interface LoopCandidate {
  id: string
  start: number
  end: number
  score: number
}

interface LoopCandidateListProps {
  candidates: LoopCandidate[]
  selectedId: string | null
  playingId: string | null
  onToggle: (id: string) => void
  onUse: (id: string) => void
  onClear: () => void
}

const LoopCandidateList = ({ candidates, selectedId, playingId, onToggle, onUse, onClear }: LoopCandidateListProps) => {
  if (!candidates.length) return null

  return (
    <div className="px-4 pb-2 border-b border-border/60">
      <div className="sticky top-0 z-10 flex justify-between items-center px-1 py-2 gap-2 bg-base/95 backdrop-blur border-b border-border/60">
        <span className="text-[11px] font-semibold text-faint tracking-wide select-none">
          Loop candidates
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-faint/60 font-mono select-none">
            {candidates.length} {candidates.length === 1 ? 'loop' : 'loops'}
          </span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Dismiss
          </Button>
        </div>
      </div>
      <ul className="list-none flex flex-col m-0 p-0">
        {candidates.map((candidate, index) => {
          const isSelected = candidate.id === selectedId
          const isPlaying = candidate.id === playingId
          const matchPct = Math.round(candidate.score * 100)
          return (
            <li
              key={candidate.id}
              className={cn(
                'flex items-center justify-between gap-3 px-2 h-[30px] rounded-md cursor-pointer select-none transition-colors',
                isSelected ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-raised hover:text-ink'
              )}
              onClick={() => onToggle(candidate.id)}
            >
              <span className="text-[10px] tabular-nums shrink-0 w-5 text-right text-faint font-mono">
                {String(index + 1).padStart(2, '0')}
              </span>

              <button
                type="button"
                title={isPlaying ? 'Stop' : 'Play loop (repeats)'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(candidate.id)
                }}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded-md bg-transparent border-0 cursor-pointer transition-colors hover:bg-raised',
                  isPlaying ? 'text-accent' : 'text-faint hover:text-accent'
                )}
              >
                {isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" className="translate-x-px" />}
              </button>

              <span className="flex-1 text-sm font-medium truncate font-mono tabular-nums">
                {formatTime(candidate.start)} – {formatTime(candidate.end)}
              </span>

              <span
                className="text-[11px] tabular-nums shrink-0 text-faint font-mono"
                title="Loop quality (energy consistency)"
              >
                {matchPct}% match
              </span>

              <span className="text-[11px] tabular-nums shrink-0 text-faint font-mono">
                {formatTime(candidate.end - candidate.start)}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onUse(candidate.id)
                }}
              >
                Use
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default LoopCandidateList
