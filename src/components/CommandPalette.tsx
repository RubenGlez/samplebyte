import { useEffect, useMemo, useRef, useState } from 'react'
import { Scissors, Library as LibraryIcon, Grid2x2, FileAudio, FolderInput, Search } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useToastStore } from '@/stores/toast'
import { cn } from '@/lib/utils'
import { mimeTypeFromPath, toLocalFileUrl } from '@/utils'

interface Command {
  id: string
  label: string
  hint?: string
  Icon: typeof Scissors
  run: () => void | Promise<void>
}

// ⌘K palette: keyboard-first jump to a view or file action. Deliberately small — navigation plus the
// two entry points (open audio, import folder) that otherwise hide in the sidebar. Run order: close,
// then act, so a view switch isn't masked by the overlay.
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { setView } = useUiStore()
  const { setAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()
  const { importFolder } = useLibraryStore()
  const { toast } = useToastStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    // Lets a click affordance (the toolbar ⌘K button) open the same palette without lifting state.
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('samplebyte:open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('samplebyte:open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const go = (view: 'chop' | 'library' | 'packs') => () => setView(view)

    const openFile = async () => {
      const filePath = await window.api.fs.pickFile()
      if (!filePath) return
      setActiveProject(null)
      setAudio({
        name: filePath.split('/').pop() ?? 'audio',
        path: toLocalFileUrl(filePath),
        filePath,
        size: 0,
        type: mimeTypeFromPath(filePath),
        source: 'local',
      })
      setView('chop')
    }

    const importToLibrary = async () => {
      const folderPath = await window.api.fs.pickFolder()
      if (!folderPath) return
      const { imported, skipped } = await importFolder(folderPath)
      const msg = imported === 0
        ? `No new files found (${skipped} already in library)`
        : `Imported ${imported} sample${imported !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`
      toast(msg, imported === 0 ? 'info' : 'success')
      setView('library')
    }

    return [
      { id: 'go-chop',    label: 'Go to Chop',      hint: 'Edit a waveform', Icon: Scissors,    run: go('chop') },
      { id: 'go-library', label: 'Go to Library',   hint: 'Browse samples',  Icon: LibraryIcon, run: go('library') },
      { id: 'go-packs',   label: 'Go to Packs',     hint: 'Pad export grid', Icon: Grid2x2,     run: go('packs') },
      { id: 'open-file',  label: 'Open audio file…', hint: 'Load into Chop',  Icon: FileAudio,   run: openFile },
      { id: 'import',     label: 'Import folder to Library…', Icon: FolderInput, run: importToLibrary },
    ]
  }, [setView, setAudio, setActiveProject, importFolder, toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  if (!open) return null

  const clampedActive = Math.min(active, Math.max(0, filtered.length - 1))

  const runCommand = (cmd: Command | undefined) => {
    if (!cmd) return
    setOpen(false)
    void cmd.run()
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(filtered[clampedActive])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[460px] max-w-[90vw] rounded-xl bg-overlay border border-border-bright shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 h-11 border-b border-border">
          <Search size={14} className="text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onInputKeyDown}
            placeholder="Search commands…"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-faint"
          />
        </div>

        <div className="py-1.5 max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-faint/60 px-3.5 py-3">No matching commands</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onMouseMove={() => setActive(i)}
                onClick={() => runCommand(cmd)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 h-9 text-left bg-transparent border-0 cursor-pointer transition-colors',
                  i === clampedActive ? 'bg-accent/15' : 'hover:bg-raised'
                )}
              >
                <cmd.Icon size={14} className={cn('shrink-0', i === clampedActive ? 'text-accent' : 'text-faint')} />
                <span className={cn('flex-1 text-[13px] truncate', i === clampedActive ? 'text-ink' : 'text-muted')}>
                  {cmd.label}
                </span>
                {cmd.hint && <span className="text-[11px] text-faint/55 shrink-0">{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
