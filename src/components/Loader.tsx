import { DragEvent, useEffect, useState, FormEvent } from 'react'
import { Search, Download, Play, Square, Loader2, Key } from 'lucide-react'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { useFreesoundStore, type FreesoundSort, type FreesoundDuration } from '@/stores/freesound'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { cn } from '@/lib/utils'
import { formatTime, mimeTypeFromPath, toLocalFileUrl } from '@/utils'
import type { FreesoundResult } from '@/types'

const AUDIO_EXTENSIONS = /\.(wav|mp3|flac|aiff?|ogg|m4a)$/i
const FORMATS = ['WAV', 'MP3', 'FLAC', 'AIFF', 'OGG']

const CATEGORIES = [
  { label: 'Kick',    query: 'kick drum' },
  { label: 'Snare',   query: 'snare' },
  { label: 'Hi-Hat',  query: 'hi-hat' },
  { label: '808',     query: '808' },
  { label: 'Clap',    query: 'clap' },
  { label: 'Cymbal',  query: 'cymbal' },
  { label: 'Bass',    query: 'bass' },
  { label: 'Synth',   query: 'synth' },
  { label: 'Vocal',   query: 'vocal' },
  { label: 'Foley',   query: 'foley' },
  { label: 'Ambient', query: 'ambient' },
  { label: 'Loop',    query: 'drum loop' },
]

const SORT_OPTIONS: { value: FreesoundSort; label: string }[] = [
  { value: 'score',          label: 'Relevance' },
  { value: 'downloads_desc', label: 'Downloads' },
  { value: 'rating_desc',    label: 'Rating' },
  { value: 'created_desc',   label: 'Newest' },
]

const DURATION_OPTIONS: { value: FreesoundDuration; label: string }[] = [
  { value: 'any',    label: 'Any' },
  { value: 'short',  label: '<5s' },
  { value: 'medium', label: '5–30s' },
  { value: 'long',   label: '>30s' },
]

type Tab = 'local' | 'freesound'

export default function Loader() {
  const { setAudio } = usePlayerStore()
  const { setActiveProject } = useProjectsStore()
  const { toast } = useToastStore()
  const { setView } = useUiStore()
  const [isDragging, setIsDragging] = useState(false)
  const [tab, setTab] = useState<Tab>('local')

  const loadFile = (file: File) => {
    const filePath = window.api.fs.getPathForFile(file)
    if (!filePath) {
      toast('Could not read that file path', 'error')
      return
    }

    setActiveProject(null)
    setAudio({ name: file.name, path: toLocalFileUrl(filePath), filePath, size: file.size, type: file.type || mimeTypeFromPath(filePath), source: 'local' })
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
    setAudio({ name: filePath.split('/').pop() ?? 'audio', path: toLocalFileUrl(filePath), filePath, size: 0, type: mimeTypeFromPath(filePath), source: 'local' })
  }

  const handleFreesoundLoad = ({ name, filePath }: { name: string; filePath: string }) => {
    setActiveProject(null)
    setAudio({ name, path: toLocalFileUrl(filePath), filePath, size: 0, type: 'audio/mpeg', source: 'freesound' })
    setView('chop')
    toast(`"${name}" ready to chop`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-px px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
          {(['local', 'freesound'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'h-[24px] px-4 rounded-[4px] text-[12px] font-medium transition-all cursor-pointer border-0',
                tab === t
                  ? 'bg-[rgba(255,255,255,0.12)] text-ink'
                  : 'text-faint/70 hover:text-muted bg-transparent'
              )}
            >
              {t === 'freesound' ? 'Freesound' : 'Local'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'local' ? (
        <div
          className="relative flex flex-col items-center justify-center flex-1 gap-5"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="absolute inset-0 border-2 border-dashed border-accent bg-accent/5 flex items-center justify-center pointer-events-none">
              <p className="text-accent text-[13px] font-medium">Drop to load</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-xl bg-raised border border-border flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <p className="text-[13px] text-ink font-medium m-0">Drop an audio file</p>
                <button onClick={handlePickFile} className="text-accent hover:text-accent-bright text-[12px] font-medium underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 transition-colors">
                  Browse files…
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {FORMATS.map((fmt) => (
                  <span key={fmt} className="px-1.5 py-0.5 rounded bg-raised border border-border text-[10px] text-faint/70 font-mono">
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
    </div>
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
      <div className="flex items-center justify-center flex-1 h-full">
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
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-8">
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
          className="px-3 h-8 rounded-md bg-accent text-white text-[12px] font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function FreesoundSearch({ onLoad, onClearKey }: { onLoad: (file: { name: string; filePath: string }) => void; onClearKey: () => void }) {
  const { query, results, hasMore, isSearching, isDownloading, search, loadMore, sort, durationFilter, setSort, setDurationFilter, startDownload, endDownload } = useFreesoundStore()
  const [inputValue, setInputValue] = useState(query)
  const { toast } = useToastStore()

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) search(inputValue.trim())
  }

  const handleCategoryClick = (categoryQuery: string) => {
    setInputValue(categoryQuery)
    search(categoryQuery)
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

  const isEmpty = results.length === 0 && !isSearching

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 p-3 border-b border-border shrink-0">
        <div className="flex gap-2">
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
            className="px-3 h-8 rounded-md bg-accent text-white text-[12px] font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0 shrink-0"
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
        </div>
        {/* Sort & duration controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <FilterPills label="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
          <FilterPills label="Duration" options={DURATION_OPTIONS} value={durationFilter} onChange={setDurationFilter} />
        </div>
      </form>

      {/* Results / empty state */}
      <div className="overflow-y-auto flex-1">
        {isEmpty ? (
          <div className="flex flex-col gap-3 p-3">
            <p className="text-[11px] font-semibold text-faint select-none tracking-wide">Browse by type</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleCategoryClick(cat.query)}
                  className="px-2.5 py-1 rounded-md bg-raised border border-border text-[12px] text-muted hover:text-ink hover:border-border-bright hover:bg-overlay transition-colors cursor-pointer"
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-faint/50 mt-1">or type any search term above</p>
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

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-faint/60 shrink-0">{label}:</span>
      <div className="flex items-center gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-[20px] px-2 rounded text-[10px] font-medium transition-colors cursor-pointer border-0',
              value === opt.value
                ? 'bg-accent/20 text-accent'
                : 'text-faint/60 hover:text-muted bg-transparent hover:bg-raised'
            )}
          >
            {opt.label}
          </button>
        ))}
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
