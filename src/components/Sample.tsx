import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import { type Region } from 'wavesurfer.js/dist/plugins/regions'

interface SampleProps {
  sample: Region
  isSelected: boolean
  index: number
  initialName?: string
  onClick: (region: Region) => void
  onNameChange?: (regionId: string, name: string) => void
}

export default function Sample({ sample, isSelected, index, initialName, onClick, onNameChange }: SampleProps) {
  const [name, setName] = useState(initialName ?? `Chop ${String(index + 1).padStart(2, '0')}`)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const duration = sample.end - sample.start

  const commitName = () => {
    setIsEditing(false)
    onNameChange?.(sample.id, name)
  }

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 px-2 py-2 rounded text-sm cursor-pointer select-none transition-colors',
        isSelected
          ? 'bg-accent/10 text-ink'
          : 'text-muted hover:bg-raised hover:text-ink'
      )}
      onClick={() => onClick(sample)}
    >
      <span className="text-[10px] tabular-nums shrink-0 w-5 text-right text-faint font-mono">
        {String(index + 1).padStart(2, '0')}
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') setIsEditing(false)
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border-0 border-b border-accent/50 outline-none text-sm text-ink py-0 px-0"
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium truncate"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
            setTimeout(() => inputRef.current?.select(), 0)
          }}
          title="Double-click to rename"
        >
          {name}
        </span>
      )}

      <span className="text-[11px] tabular-nums shrink-0 text-faint font-mono">
        {formatTime(duration)}
      </span>

      {isSelected && (
        <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
      )}
    </li>
  )
}
