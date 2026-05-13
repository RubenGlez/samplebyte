import { Scissors, Library, Grid2x2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

const tabs = [
  { id: 'chop',    label: 'Chop',    icon: Scissors },
  { id: 'library', label: 'Library', icon: Library  },
  { id: 'packs',   label: 'Packs',   icon: Grid2x2  },
] as const

export default function Nav() {
  const { currentView, setView } = useUiStore()

  return (
    <nav className="flex items-stretch h-11 border-b border-border shrink-0 bg-surface">
      {/* Brand */}
      <div className="flex items-center px-5 border-r border-border mr-2">
        <span
          className="text-accent text-sm font-bold tracking-[0.15em] uppercase select-none"
          style={{ fontFamily: 'var(--font-family-brand)' }}
        >
          SampleByte
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-stretch">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'relative flex items-center gap-2 px-4 text-xs font-medium tracking-wide uppercase transition-colors cursor-pointer border-0 bg-transparent',
              currentView === id
                ? 'text-ink'
                : 'text-muted hover:text-ink'
            )}
            style={{ fontFamily: 'var(--font-family-brand)' }}
          >
            <Icon size={13} strokeWidth={currentView === id ? 2 : 1.5} />
            {label}
            {currentView === id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
