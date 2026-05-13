import { Music } from 'lucide-react'
import { formatBytes, humanizeAudioType } from '@/utils'

interface CardHeaderProps {
  name: string
  size: number
  type: string
}

export default function CardHeader({ name, size, type }: CardHeaderProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
      <div className="w-9 h-9 rounded bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
        <Music size={15} className="text-accent" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium truncate leading-tight">{name}</p>
        <p className="text-xs text-faint mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>
          {humanizeAudioType(type)}
          {size > 0 && <span className="ml-3">{formatBytes(size)}</span>}
        </p>
      </div>
    </div>
  )
}
