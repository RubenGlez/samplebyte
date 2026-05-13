import { Music, X } from 'lucide-react'
import { formatBytes, humanizeAudioType } from '@/utils'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'

interface CardHeaderProps {
  name: string
  size: number
  type: string
}

export default function CardHeader({ name, size, type }: CardHeaderProps) {
  const { clearAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()

  const handleClose = () => {
    setActiveProject(null)
    clearAudio()
  }

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
      <button
        onClick={handleClose}
        title="Close file"
        className="text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 p-1.5 rounded cursor-pointer shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
