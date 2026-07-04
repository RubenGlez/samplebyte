import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { Segmented } from '@/components/ui/Segmented'
import { SettingsDialog } from '@/components/SettingsDialog'
import { modLabel } from '@/utils'

type View = 'chop' | 'library' | 'packs'

const segments: { value: View; label: string }[] = [
  { value: 'chop',    label: 'Chop'    },
  { value: 'library', label: 'Library' },
  { value: 'packs',   label: 'Packs'   },
]

// WebkitAppRegion is Electron-specific and not in standard React.CSSProperties
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

export default function Toolbar() {
  const { currentView, setView, sidebarOpen, toggleSidebar } = useUiStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div
      className="h-11 flex items-center shrink-0 border-b border-border bg-surface"
      style={{ WebkitAppRegion: 'drag' } as ElectronStyle}
    >
      {/* Traffic lights gap + sidebar toggle */}
      <div
        className="flex items-center pl-[88px] pr-2 shrink-0"
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
      <div style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}>
        <Segmented options={segments} value={currentView} onChange={setView} />
      </div>

      {/* Flex spacer — draggable */}
      <div className="flex-1" />

      {/* Command palette affordance */}
      <div
        className="shrink-0 flex items-center pr-2"
        style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}
      >
        <button
          onClick={() => window.dispatchEvent(new Event('samplebyte:open-command-palette'))}
          title={`Commands (${modLabel('K')})`}
          className="flex items-center gap-1 px-2 h-[26px] rounded-[5px] text-faint/70 hover:text-muted hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer select-none"
        >
          <span className="text-[11px] font-readout leading-none">{modLabel('K')}</span>
        </button>
      </div>

      {/* Settings */}
      <div
        className="shrink-0 flex items-center pr-2"
        style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}
      >
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="w-7 h-7 flex items-center justify-center rounded-md text-faint hover:text-ink hover:bg-raised transition-colors bg-transparent border-0 cursor-pointer"
        >
          <Settings size={15} strokeWidth={1.5} />
        </button>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>

      {/* Ko-fi */}
      <div
        className="shrink-0 flex items-center pr-3"
        style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}
      >
        <button
          onClick={() => window.api.shell.openExternal('https://ko-fi.com/rubenglez')}
          title="Support this project on Ko-fi"
          className="flex items-center gap-1.5 px-2.5 h-[26px] rounded-[5px] text-[11px] text-faint/80 hover:text-muted hover:bg-raised border border-border/70 hover:border-border-bright transition-colors bg-raised/35 cursor-pointer select-none whitespace-nowrap"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 2.68.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
          </svg>
          Buy me a coffee
        </button>
      </div>
    </div>
  )
}
