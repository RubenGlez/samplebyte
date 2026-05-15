import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

type View = 'chop' | 'library' | 'packs'

const segments: { id: View; label: string }[] = [
  { id: 'chop',    label: 'Chop'    },
  { id: 'library', label: 'Library' },
  { id: 'packs',   label: 'Packs'   },
]

// WebkitAppRegion is Electron-specific and not in standard React.CSSProperties
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

export default function Toolbar() {
  const { currentView, setView, sidebarOpen, toggleSidebar } = useUiStore()

  return (
    <div
      className="h-11 flex items-center shrink-0 border-b border-border bg-surface"
      style={{ WebkitAppRegion: 'drag' } as ElectronStyle}
    >
      {/* Traffic lights gap + sidebar toggle */}
      <div
        className="flex items-center pl-[72px] pr-2 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          className="w-7 h-7 flex items-center justify-center rounded-md text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
        >
          {sidebarOpen
            ? <PanelLeftClose size={15} strokeWidth={1.5} />
            : <PanelLeftOpen  size={15} strokeWidth={1.5} />
          }
        </button>
      </div>

      {/* Brand */}
      <span className="text-[13px] font-semibold text-ink tracking-tight select-none pr-5">
        SampleByte
      </span>

      {/* Flex spacer — draggable */}
      <div className="flex-1" />

      {/* Segmented control — macOS style */}
      <div
        className="flex items-center p-[3px] rounded-[8px] bg-[rgba(255,255,255,0.06)]"
        style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}
      >
        {segments.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'h-[26px] px-3.5 rounded-[5px] text-[12px] font-medium transition-all duration-150 cursor-pointer border-0 select-none',
              currentView === id
                ? 'bg-[rgba(255,255,255,0.13)] text-ink'
                : 'text-muted hover:text-ink bg-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Flex spacer — draggable */}
      <div className="flex-1" />

      {/* Right balance pad (mirrors left side width) */}
      <div className="w-[106px] shrink-0" />
    </div>
  )
}
