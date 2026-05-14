import { Scissors, Library, Grid2x2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

const tabs = [
  { id: 'chop',    label: 'Chop',    icon: Scissors },
  { id: 'library', label: 'Library', icon: Library  },
  { id: 'packs',   label: 'Packs',   icon: Grid2x2  },
] as const

export default function Nav() {
  const { currentView, setView, sidebarOpen } = useUiStore()

  return (
    <nav className="flex items-stretch h-11 border-b border-border shrink-0 bg-surface">
      {/* Brand — matches sidebar width so columns align */}
      <div
        className={cn(
          'flex items-center justify-center border-r border-border shrink-0 overflow-hidden',
          'transition-[width] duration-200 ease-in-out',
          sidebarOpen ? 'w-56' : 'w-10'
        )}
      >
        {sidebarOpen && (
          <span className="text-accent text-sm font-bold tracking-[0.15em] uppercase select-none font-brand">
            SampleByte
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-stretch">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'relative flex items-center gap-2 px-4 text-xs font-medium tracking-wide uppercase transition-colors cursor-pointer border-0 bg-transparent font-brand',
              currentView === id
                ? 'text-ink'
                : 'text-muted hover:text-ink'
            )}
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
