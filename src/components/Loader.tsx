import { DragEvent, useEffect, useState, FormEvent } from 'react'
import { Search, Download, Play, Square, Loader2, Key } from 'lucide-react'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useFreesoundStore } from '@/stores/freesound'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { cn } from '@/lib/utils'
import { formatTime, mimeTypeFromPath } from '@/utils'
import type { FreesoundResult } from '@/types'
import CardRoot from './Card/CardRoot'

const AUDIO_EXTENSIONS = /\.(wav|mp3|flac|aiff?|ogg|m4a)$/i
const FORMATS = ['WAV', 'MP3', 'FLAC', 'AIFF', 'OGG']

type Tab = 'local' | 'freesound'

export default function Loader() {
  const { setAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()
  const { toast } = useToastStore()
  const { setView } = useUiStore()
  const [isDragging, setIsDragging] = useState(false)
  const [tab, setTab] = useState<Tab>('local')

  const loadFile = (file: File) => {
    setActiveProject(null)
    setAudio({ name: file.name, path: URL.createObjectURL(file), filePath: file.path, size: file.size, type: file.type })
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && AUDIO_EXTENSIONS.test(file.name)) loadFile(file)
  }

  const handlePickFile = async () => {
    const filePath = await window.api.fs.pickFile()
    if (!filePath) return
    setActiveProject(null)
    setAudio({ name: filePath.split('/').pop() ?? 'audio', path: `local-file://${filePath}`, filePath, size: 0, type: mimeTypeFromPath(filePath) })
  }

  const handleFreesoundLoad = ({ name, filePath }: { name: string; filePath: string }) => {
    setActiveProject(null)
    setAudio({ name, path: `local-file://${filePath}`, filePath, size: 0, type: 'audio/mpeg' })
    setView('chop')
    toast(`"${name}" ready to chop`)
  }

  return (
    <CardRoot>
      {/* Tab bar */}
      <div className="flex border-b border-border bg-raised">
        {(['local', 'freesound'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative px-5 py-3 text-xs font-medium transition-colors bg-transparent border-0 cursor-pointer font-brand',
              tab === t ? 'text-ink' : 'text-faint hover:text-muted'
            )}
          >
            {t === 'freesound' ? 'Freesound' : 'Local'}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-accent" />
            )}
          </button>
        ))}
      </div>

      {tab === 'local' ? (
        <div
          className="relative flex flex-col items-center justify-center h-64 gap-5"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="absolute inset-0 rounded-b-lg border-2 border-dashed border-accent bg-accent/5 flex items-center justify-center pointer-events-none">
              <p className="text-accent text-sm font-medium font-brand">Drop to load</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-xl bg-raised border border-border-bright flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <p className="text-sm text-ink font-medium m-0">Drop an audio file here</p>
                <p className="text-xs text-faint m-0">or</p>
                <button onClick={handlePickFile} className="text-accent hover:text-accent-bright text-xs font-medium underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 transition-colors">
                  Browse files
                </button>
              </div>
              <div className="flex items-center gap-2">
                {FORMATS.map((fmt) => (
                  <span key={fmt} className="px-2 py-0.5 rounded bg-raised border border-border text-[10px] text-faint font-mono">
                    {fmt}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <FreesoundTab onLoad={handleFreesoundLoad} />
      )}
    </CardRoot>
  )
}

function FreesoundTab({ onLoad }: { onLoad: (file: { name: string; filePath: string }) => void }) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [keyLoaded, setKeyLoaded] = useState(false)

  useEffect(() => {
    window.api.settings.get('freesound_api_key').then((k) => {
      setApiKey((k as string | null) || null)
      setKeyLoaded(true)
    })
  }, [])

  if (!keyLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={16} className="text-faint animate-spin" />
      </div>
    )
  }

  if (!apiKey) {
    return <ApiKeySetup onSave={(k) => setApiKey(k)} />
  }

  return <FreesoundSearch onLoad={onLoad} onClearKey={() => setApiKey(null)} />
}

function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    await window.api.settings.set('freesound_api_key', trimmed)
    onSave(trimmed)
    setSaving(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
      <div className="w-10 h-10 rounded-xl bg-raised border border-border-bright flex items-center justify-center">
        <Key size={16} className="text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm text-ink font-medium mb-1">Freesound API Key</p>
        <p className="text-xs text-faint">
          Get a free key at{' '}
          <span className="text-accent">freesound.org/apiv2/apply</span>
        </p>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Paste your API key…"
          className="flex-1 bg-surface border border-border rounded px-3 h-8 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={!value.trim() || saving}
          className="px-3 h-8 rounded bg-accent text-[#0A0806] text-xs font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0 font-brand"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function FreesoundSearch({ onLoad, onClearKey }: { onLoad: (file: { name: string; filePath: string }) => void; onClearKey: () => void }) {
  const { query, results, hasMore, isSearching, isDownloading, search, loadMore } = useFreesoundStore()
  const [inputValue, setInputValue] = useState(query)
  const { toast } = useToastStore()
  const { startDownload, endDownload } = useFreesoundStore()

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) search(inputValue.trim())
  }

  const handleDownload = async (sound: FreesoundResult) => {
    startDownload(sound.id)
    try {
      const file = await window.api.freesound.download(sound.id, sound.name, sound.previews['preview-hq-mp3'])
      onLoad(file)
    } catch {
      toast('Download failed', 'error')
    } finally {
      endDownload(sound.id)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 p-3 border-b border-border">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search Freesound…"
            className="w-full bg-raised border border-border rounded pl-9 pr-3 h-8 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim() || isSearching}
          className="px-3 h-8 rounded bg-accent text-[#0A0806] text-xs font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0 shrink-0 font-brand"
        >
          {isSearching && results.length === 0 ? <Loader2 size={12} className="animate-spin" /> : 'Search'}
        </button>
        <button
          type="button"
          onClick={async () => { await window.api.settings.set('freesound_api_key', null); onClearKey() }}
          className="text-[10px] text-faint/50 hover:text-faint bg-transparent border-0 cursor-pointer transition-colors px-1"
          title="Change API key"
        >
          <Key size={12} />
        </button>
      </form>

      {/* Results */}
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {results.length === 0 && !isSearching ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-faint">
            <p className="text-sm">Search for sounds on Freesound.org</p>
            <p className="text-xs text-faint/60">drums, synths, field recordings…</p>
          </div>
        ) : (
          <>
            {results.map((sound) => (
              <FreesoundRow
                key={sound.id}
                sound={sound}
                isDownloading={isDownloading.includes(sound.id)}
                onDownload={() => handleDownload(sound)}
              />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isSearching}
                className="w-full py-3 text-xs text-faint hover:text-muted transition-colors bg-transparent border-0 cursor-pointer border-t border-border"
              >
                {isSearching ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FreesoundRow({ sound, isDownloading, onDownload }: { sound: FreesoundResult; isDownloading: boolean; onDownload: () => void }) {
  const { isPlaying, toggle } = useAudioPlayer(sound.previews['preview-hq-mp3'])

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggle()
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 hover:bg-raised transition-colors group">
      <button
        onClick={togglePlay}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors border',
          isPlaying ? 'bg-accent border-accent text-[#0A0806]' : 'bg-raised border-border text-faint group-hover:border-border-bright'
        )}
      >
        {isPlaying ? <Square size={8} fill="currentColor" /> : <Play size={8} fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate leading-tight">{sound.name.replace(/\.[^.]+$/, '')}</p>
        <p className="text-[11px] text-faint mt-0.5 truncate">
          <span className="font-mono">{formatTime(sound.duration)}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {sound.username}
          {sound.tags.slice(0, 3).length > 0 && (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {sound.tags.slice(0, 3).join(', ')}
            </>
          )}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDownload() }}
        disabled={isDownloading}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded border border-border text-faint hover:border-accent hover:text-accent transition-colors disabled:opacity-40 bg-transparent cursor-pointer"
        title="Import to Library"
      >
        {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
      </button>
    </div>
  )
}
