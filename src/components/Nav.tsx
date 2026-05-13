import { Scissors, Library, Grid2x2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

const tabs = [
  { id: 'chop',    label: 'Chop',    icon: Scissors  },
  { id: 'library', label: 'Library', icon: Library   },
  { id: 'packs',   label: 'Packs',   icon: Grid2x2   },
] as const

export default function Nav() {
  const { currentView, setView } = useUiStore()

  return (
    <nav className="flex items-center gap-1 px-4 h-12 border-b border-white/10 shrink-0">
      <span className="text-white/20 text-xs font-bold tracking-widest uppercase mr-4">
        SampleByte
      </span>

      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={cn(
            'flex items-center gap-2 px-3 h-8 rounded text-sm transition-colors cursor-pointer border-0',
            currentView === id
              ? 'bg-white/10 text-white'
              : 'bg-transparent text-white/40 hover:text-white/70'
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </nav>
  )
}
