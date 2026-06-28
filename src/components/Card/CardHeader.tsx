import { Music } from 'lucide-react'
import { formatBytes, humanizeAudioType } from '@/utils'

interface CardHeaderProps {
  name: string
  size: number
  type: string
  bpm?: number | null
  musicalKey?: string | null
  loopBars?: number | null
  isAnalyzing?: boolean
  actions?: React.ReactNode
}

export default function CardHeader({ name, size, type, bpm, musicalKey, loopBars, isAnalyzing, actions }: CardHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-surface shrink-0">
      <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
        <Music size={14} className="text-accent" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink font-semibold truncate leading-none m-0">{name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-faint font-readout">
            {humanizeAudioType(type)}
            {size > 0 && <span className="ml-2">{formatBytes(size)}</span>}
          </span>
          {isAnalyzing && (
            <span className="text-[11px] text-faint/50 animate-pulse font-readout">analyzing…</span>
          )}
          {!isAnalyzing && (bpm != null || musicalKey != null || loopBars != null) && (
            <span className="flex items-center gap-2.5 font-readout text-[11px]">
              {bpm != null && (
                <span className="text-accent">
                  {Math.round(bpm)}<span className="text-accent/55 ml-0.5">BPM</span>
                </span>
              )}
              {musicalKey != null && <span className="text-accent/70">{musicalKey}</span>}
              {loopBars != null && <span className="text-accent/50">{loopBars}-bar loop</span>}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  )
}
