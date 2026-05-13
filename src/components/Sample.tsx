import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import { type Region } from 'wavesurfer.js/dist/plugins/regions'

interface SampleProps {
  sample: Region
  isSelected: boolean
  index: number
  onClick: (region: Region) => void
  onNameChange?: (regionId: string, name: string) => void
}

export default function Sample({ sample, isSelected, index, onClick, onNameChange }: SampleProps) {
  const [name, setName] = useState(`Sample ${index + 1}`)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const duration = sample.end - sample.start

  const handleClick = () => {
    onClick(sample)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitName = () => {
    setIsEditing(false)
    onNameChange?.(sample.id, name)
  }

  return (
    <li
      className={cn(
        'py-2 px-3 flex flex-row items-center justify-between gap-2 text-white/50',
        'border border-solid border-white/10 border-b-0 border-x-0 last:border-b',
        'cursor-pointer select-none',
        isSelected && 'bg-white/5 text-white/80'
      )}
      onClick={handleClick}
    >
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
          className="bg-transparent border-0 border-b border-sky-500 outline-none text-sm text-white flex-1 py-0 px-0"
          autoFocus
        />
      ) : (
        <span className="text-sm font-medium flex-1" onDoubleClick={handleDoubleClick} title="Double-click to rename">
          {name}
        </span>
      )}
      <span className="text-xs text-white/30 tabular-nums shrink-0">{formatTime(duration)}</span>
    </li>
  )
}
