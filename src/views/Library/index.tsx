import { useEffect, useRef, useState } from 'react'
import { Search, Trash2, Play, Square, Pencil, FolderOpen, Tag, X } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import type { Sample, Project } from '@/types'

export default function LibraryView() {
  const { samples, searchQuery, projectFilter, filters, isLoading, fetchSamples, deleteSample, updateSample, setSearchQuery, setProjectFilter, toggleTagFilter, setFilters } = useLibraryStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { toast } = useToastStore()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchSamples()
    fetchProjects()
  }, [fetchSamples, fetchProjects])

  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]))
  const activeTags = filters.tags ?? []

  const filtered = samples.filter((s) => {
    if (!s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (projectFilter === '__none__' && s.projectId !== null) return false
    if (projectFilter !== null && projectFilter !== '__none__' && s.projectId !== projectFilter) return false
    if (activeTags.length > 0 && !activeTags.some((t) => s.tags.includes(t))) return false
    return true
  })

  const togglePlay = (sample: Sample) => {
    if (playingId === sample.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(`local-file://${sample.filePath}`)
    audio.onended = () => setPlayingId(null)
    audio.play()
    audioRef.current = audio
    setPlayingId(sample.id)
  }

  const handleDelete = async (sample: Sample, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${sample.name}"?`)) return
    if (playingId === sample.id) { audioRef.current?.pause(); setPlayingId(null) }
    await deleteSample(sample.id)
    toast('Sample deleted', 'info')
  }

  const handleRename = async (sample: Sample, name: string) => {
    if (!name.trim() || name === sample.name) return
    await updateSample(sample.id, { name: name.trim() })
    toast('Sample renamed')
  }

  const handleTagsChange = async (sample: Sample, tags: string[]) => {
    await updateSample(sample.id, { tags })
  }

  const hasFilters = searchQuery || projectFilter || activeTags.length > 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search samples…"
            className="w-56 bg-surface border border-border rounded pl-9 pr-3 h-8 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {/* Project filter */}
        {projects.length > 0 && (
          <div className="relative">
            <FolderOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <select
              value={projectFilter ?? ''}
              onChange={(e) => setProjectFilter(e.target.value || null)}
              className="appearance-none bg-surface border border-border rounded pl-9 pr-6 h-8 text-sm text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__none__">No project</option>
            </select>
          </div>
        )}

        {/* Active tag filter chips */}
        {activeTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px]">
                {tag}
                <button onClick={() => toggleTagFilter(tag)} className="hover:text-red-400 transition-colors bg-transparent border-0 p-0 cursor-pointer leading-none">
                  <X size={10} />
                </button>
              </span>
            ))}
            <button onClick={() => setFilters({ ...filters, tags: undefined })} className="text-[10px] text-faint/60 hover:text-faint bg-transparent border-0 cursor-pointer transition-colors">
              clear
            </button>
          </div>
        )}

        <span className="text-xs text-faint ml-auto" style={{ fontFamily: 'var(--font-family-mono)' }}>
          {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
        </span>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-faint text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-faint">
          <p className="text-sm">{hasFilters ? 'No samples match your filters.' : 'No samples yet.'}</p>
          {!hasFilters && <p className="text-xs text-faint/70">Chop some audio and save to Library.</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {filtered.map((sample) => (
              <SampleCard
                key={sample.id}
                sample={sample}
                project={sample.projectId ? projectsById[sample.projectId] : undefined}
                isPlaying={playingId === sample.id}
                onPlayToggle={() => togglePlay(sample)}
                onDelete={(e) => handleDelete(sample, e)}
                onRename={(name) => handleRename(sample, name)}
                onTagsChange={(tags) => handleTagsChange(sample, tags)}
                onTagClick={(tag) => toggleTagFilter(tag)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SampleCard({
  sample, project, isPlaying,
  onPlayToggle, onDelete, onRename, onTagsChange, onTagClick,
}: {
  sample: Sample
  project: Project | undefined
  isPlaying: boolean
  onPlayToggle: () => void
  onDelete: (e: React.MouseEvent) => void
  onRename: (name: string) => void
  onTagsChange: (tags: string[]) => void
  onTagClick: (tag: string) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(sample.name)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitRename = () => { setIsRenaming(false); onRename(draftName) }
  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftName(sample.name)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  return (
    <>
      <div
        className={cn(
          'group relative bg-surface border rounded-lg p-4 flex flex-col gap-3 cursor-pointer transition-all',
          isPlaying ? 'border-accent/30 bg-accent/5' : 'border-border hover:border-border-bright hover:bg-raised'
        )}
        onClick={onPlayToggle}
      >
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0',
          isPlaying ? 'bg-accent text-[#0A0806]' : 'bg-raised border border-border text-faint group-hover:border-border-bright group-hover:text-muted'
        )}>
          {isPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        </div>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false); e.stopPropagation() }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent border-0 border-b border-accent/50 outline-none text-sm text-ink font-medium py-0 px-0"
              autoFocus
            />
          ) : (
            <p className="text-sm text-ink font-medium truncate leading-tight">{sample.name}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5">
            {sample.duration != null && (
              <span className="text-[11px] text-faint tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>{formatTime(sample.duration)}</span>
            )}
            {sample.bpm != null && (
              <span className="text-[10px] text-accent/70 tabular-nums" style={{ fontFamily: 'var(--font-family-mono)' }}>{Math.round(sample.bpm)} BPM</span>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {sample.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag) }}
                className="px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-[10px] text-accent/70 hover:bg-accent/20 transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
            {sample.tags.length > 3 && (
              <span className="text-[10px] text-faint/60">+{sample.tags.length - 3}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditingTags(true) }}
              className={cn(
                'text-[10px] text-faint/50 hover:text-faint bg-transparent border-0 p-0 cursor-pointer transition-colors',
                sample.tags.length > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-60'
              )}
            >
              {sample.tags.length === 0 ? '+ tags' : '+'}
            </button>
          </div>

          {/* Project badge */}
          {project && (
            <div className="mt-2 flex items-center gap-1 min-w-0">
              <FolderOpen size={9} className="text-faint/60 shrink-0" />
              <span className="text-[10px] text-faint/60 truncate">{project.name}</span>
            </div>
          )}
        </div>

        <button onClick={onDelete} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-red-400 bg-transparent border-0 p-1 cursor-pointer rounded">
          <Trash2 size={11} />
        </button>
        <button onClick={startRename} className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer rounded" title="Rename">
          <Pencil size={11} />
        </button>

        {isPlaying && <span className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
      </div>

      {/* Tag editing dialog */}
      <TagDialog
        sample={sample}
        open={isEditingTags}
        onOpenChange={setIsEditingTags}
        onTagsChange={onTagsChange}
      />
    </>
  )
}

function TagDialog({ sample, open, onOpenChange, onTagsChange }: {
  sample: Sample
  open: boolean
  onOpenChange: (open: boolean) => void
  onTagsChange: (tags: string[]) => void
}) {
  const [tags, setTags] = useState<string[]>(sample.tags)
  const [input, setInput] = useState('')

  useEffect(() => { if (open) setTags(sample.tags) }, [open, sample.tags])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')
    if (!tag || tags.includes(tag)) return
    const next = [...tags, tag]
    setTags(next)
    onTagsChange(next)
    setInput('')
  }

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    onTagsChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="flex items-center gap-2">
            <Tag size={14} className="text-faint" />
            Tags — <span className="text-faint font-normal truncate max-w-32">{sample.name}</span>
          </DialogTitle>
          <DialogClose asChild>
            <button className="text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer transition-colors rounded">
              <X size={14} />
            </button>
          </DialogClose>
        </div>

        {/* Existing tags */}
        <div className="flex flex-wrap gap-2 min-h-8 mb-4">
          {tags.length === 0
            ? <p className="text-xs text-faint/60">No tags yet.</p>
            : tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent/80 text-xs">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors bg-transparent border-0 p-0 cursor-pointer leading-none">
                  <X size={10} />
                </button>
              </span>
            ))
          }
        </div>

        {/* Add tag input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
              e.stopPropagation()
            }}
            placeholder="Add a tag, press Enter…"
            className="flex-1 bg-surface border border-border rounded px-3 h-8 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
          <button
            onClick={() => addTag(input)}
            disabled={!input.trim()}
            className="px-3 h-8 rounded bg-accent text-[#0A0806] text-xs font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0"
            style={{ fontFamily: 'var(--font-family-brand)' }}
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-faint/50 mt-2">Lowercase letters, numbers, hyphens and underscores only.</p>
      </DialogContent>
    </Dialog>
  )
}
