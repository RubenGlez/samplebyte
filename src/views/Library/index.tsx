import { useEffect, useState } from 'react'
import { Trash2, Play, Square, Pencil, FolderOpen, Tag, X } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { useFilteredSamples } from '@/hooks/useFilteredSamples'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useInlineRename } from '@/hooks/useInlineRename'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import type { Sample, Project } from '@/types'

export default function LibraryView() {
  const { isLoading, fetchSamples, deleteSample, updateSample, toggleTagFilter } = useLibraryStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { toast } = useToastStore()
  const [pendingDelete, setPendingDelete] = useState<Sample | null>(null)

  useEffect(() => {
    fetchSamples()
    fetchProjects()
  }, [fetchSamples, fetchProjects])

  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]))
  const filtered = useFilteredSamples()

  const handleDelete = async () => {
    if (!pendingDelete) return
    await deleteSample(pendingDelete.id)
    toast('Sample deleted', 'info')
    setPendingDelete(null)
  }

  const handleRename = async (sample: Sample, name: string) => {
    if (!name.trim() || name === sample.name) return
    await updateSample(sample.id, { name: name.trim() })
    toast('Sample renamed')
  }

  const handleTagsChange = async (sample: Sample, tags: string[]) => {
    await updateSample(sample.id, { tags })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-faint text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-faint">
          <p className="text-sm">No samples yet.</p>
          <p className="text-xs text-faint/70">Chop some audio and save to Library.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {filtered.map((sample) => (
              <SampleCard
                key={sample.id}
                sample={sample}
                project={sample.projectId ? projectsById[sample.projectId] : undefined}
                onDeleteRequest={() => setPendingDelete(sample)}
                onRename={(name) => handleRename(sample, name)}
                onTagsChange={(tags) => handleTagsChange(sample, tags)}
                onTagClick={(tag) => toggleTagFilter(tag)}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle>Delete sample?</DialogTitle>
            <DialogClose asChild>
              <button className="text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer transition-colors rounded">
                <X size={14} />
              </button>
            </DialogClose>
          </div>
          <p className="text-sm text-muted mb-6">
            "{pendingDelete?.name}" will be permanently removed from the library.
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={handleDelete}
              className="bg-red-500/80 hover:bg-red-500 text-white border-0"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SampleCard({
  sample, project,
  onDeleteRequest, onRename, onTagsChange, onTagClick,
}: {
  sample: Sample
  project: Project | undefined
  onDeleteRequest: () => void
  onRename: (name: string) => void
  onTagsChange: (tags: string[]) => void
  onTagClick: (tag: string) => void
}) {
  const { isPlaying, toggle } = useAudioPlayer(`local-file://${sample.filePath}`)
  const { isRenaming, draftName, inputRef, setDraftName, startRename, commitRename, cancelRename } =
    useInlineRename(sample.name, onRename)
  const [isEditingTags, setIsEditingTags] = useState(false)

  return (
    <>
      <div
        className={cn(
          'group relative bg-surface border rounded-lg p-4 flex flex-col gap-3 cursor-pointer transition-all',
          isPlaying ? 'border-accent/30 bg-accent/5' : 'border-border hover:border-border-bright hover:bg-raised'
        )}
        onClick={toggle}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') cancelRename()
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent border-0 border-b border-accent/50 outline-none text-sm text-ink font-medium py-0 px-0"
              autoFocus
            />
          ) : (
            <p className="text-sm text-ink font-medium truncate leading-tight">{sample.name}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {sample.duration != null && (
              <span className="text-[11px] text-faint tabular-nums font-mono">{formatTime(sample.duration)}</span>
            )}
            {sample.bpm != null && (
              <span className="text-[10px] text-accent/70 tabular-nums font-mono">{Math.round(sample.bpm)} BPM</span>
            )}
            {sample.musicalKey != null && (
              <span className="text-[10px] text-accent/60 font-mono">{sample.musicalKey}</span>
            )}
          </div>

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

          {project && (
            <div className="mt-2 flex items-center gap-1 min-w-0">
              <FolderOpen size={9} className="text-faint/60 shrink-0" />
              <span className="text-[10px] text-faint/60 truncate">{project.name}</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDeleteRequest() }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-red-400 bg-transparent border-0 p-1 cursor-pointer rounded"
        >
          <Trash2 size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); startRename() }}
          className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer rounded"
          title="Rename"
        >
          <Pencil size={11} />
        </button>

        {isPlaying && <span className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
      </div>

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
            className="px-3 h-8 rounded bg-accent text-[#0A0806] text-xs font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0 font-brand"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-faint/50 mt-2">Lowercase letters, numbers, hyphens and underscores only.</p>
      </DialogContent>
    </Dialog>
  )
}
