import { Music } from 'lucide-react'
import { formatBytes, humanizeAudioType } from '@/utils'

interface CardHeaderProps {
  name: string
  size: number
  type: string
  bpm?: number | null
  musicalKey?: string | null
  isAnalyzing?: boolean
  actions?: React.ReactNode
}

export default function CardHeader({ name, size, type, bpm, musicalKey, isAnalyzing, actions }: CardHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
      <div className="w-9 h-9 rounded bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
        <Music size={15} className="text-accent" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium truncate leading-none m-0">{name}</p>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-faint tabular-nums m-0" style={{ fontFamily: 'var(--font-family-mono)' }}>
            {humanizeAudioType(type)}
            {size > 0 && <span className="ml-3">{formatBytes(size)}</span>}
          </p>
          {isAnalyzing && (
            <span className="text-[10px] text-faint/50 animate-pulse" style={{ fontFamily: 'var(--font-family-mono)' }}>
              analyzing…
            </span>
          )}
          {!isAnalyzing && bpm != null && (
            <span className="text-[10px] text-accent/70 tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>
              {Math.round(bpm)} BPM
            </span>
          )}
          {!isAnalyzing && musicalKey != null && (
            <span className="text-[10px] text-accent/70" style={{ fontFamily: 'var(--font-family-mono)' }}>
              {musicalKey}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
