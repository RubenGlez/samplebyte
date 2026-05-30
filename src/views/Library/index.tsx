import { useEffect, useState } from 'react'
import { Play, Square, Pencil, Tag, X, Trash2 } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { type LibraryBrowserItem, useFilteredSamples } from '@/hooks/useFilteredSamples'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useInlineRename } from '@/hooks/useInlineRename'
import { useChopWaveform } from '@/hooks/useChopWaveform'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import type { Sample, Project } from '@/types'

// Column layout — Name flex, then fixed narrow cols
const GRID = 'grid-cols-[1fr_64px_52px_72px_140px_52px]'

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
        <div className="flex-1 flex items-center justify-center text-faint text-[13px]">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Column headers */}
          <div className={cn('grid shrink-0 px-4 h-8 items-center border-b border-border bg-surface', GRID)}>
            <ColHeader label="Name" />
            <ColHeader label="Duration" right />
            <ColHeader label="BPM"      right />
            <ColHeader label="Key" />
            <ColHeader label="Project" />
            <ColHeader label="" />
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((sample, i) => (
              <LibraryRow
                key={sample.id}
                item={sample}
                project={sample.projectId ? projectsById[sample.projectId] : undefined}
                striped={i % 2 === 1}
                onDeleteRequest={sample.kind === 'sample' ? () => setPendingDelete(sample.sample) : undefined}
                onRename={sample.kind === 'sample' ? (name) => handleRename(sample.sample, name) : undefined}
                onTagsChange={sample.kind === 'sample' ? (tags) => handleTagsChange(sample.sample, tags) : undefined}
                onTagClick={(tag) => toggleTagFilter(tag)}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle>Delete sample?</DialogTitle>
            <DialogClose asChild>
              <button className="text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer transition-colors rounded-md">
                <X size={14} />
              </button>
            </DialogClose>
          </div>
          <p className="text-[13px] text-muted mb-6">
            "{pendingDelete?.name}" will be permanently removed from the library.
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleDelete} className="bg-red-500/80 hover:bg-red-500 text-white border-0">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-faint">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-25">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <div className="text-center">
        <p className="text-[13px] text-muted">No samples yet</p>
        <p className="text-[12px] text-faint/70 mt-1">Create regions in a project or import loose samples</p>
      </div>
    </div>
  )
}

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span className={cn('text-[11px] font-medium text-faint select-none tracking-wide', right && 'text-right')}>
      {label}
    </span>
  )
}

function LibraryRow({
  item, project, striped,
  onDeleteRequest, onRename, onTagsChange, onTagClick,
}: {
  item: LibraryBrowserItem
  project: Project | undefined
  striped: boolean
  onDeleteRequest?: () => void
  onRename?: (name: string) => void
  onTagsChange?: (tags: string[]) => void
  onTagClick: (tag: string) => void
}) {
  const region = item.kind === 'project-chop' ? { start: item.start, end: item.end } : null
  const { isPlaying, toggle } = useAudioPlayer(toLocalFileUrl(item.filePath), region)
  const { isRenaming, draftName, inputRef, setDraftName, startRename, commitRename, cancelRename } =
    useInlineRename(item.name, onRename ?? (() => {}))
  const [isEditingTags, setIsEditingTags] = useState(false)

  const chopWaveform = useChopWaveform(
    item.kind === 'project-chop' ? item.filePath : null,
    item.kind === 'project-chop' ? item.start : 0,
    item.kind === 'project-chop' ? item.end : 0,
  )
  const waveformData = item.kind === 'sample' ? item.sample.waveformData : chopWaveform

  const hasTags = item.tags.length > 0
  const canEdit = item.kind === 'sample' && onRename && onTagsChange && onDeleteRequest

  return (
    <>
      <div
        className={cn(
          'group grid items-center px-4 cursor-pointer transition-colors',
          hasTags ? 'pt-[6px] pb-[2px]' : 'h-[34px]',
          isPlaying
            ? 'bg-accent/10'
            : striped
              ? 'bg-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.04)]'
              : 'hover:bg-[rgba(255,255,255,0.04)]',
          GRID
        )}
        onClick={() => !isRenaming && toggle()}
      >
        {/* Name + play indicator + waveform miniature */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className={cn(
            'w-5 h-5 flex items-center justify-center rounded-full shrink-0 transition-colors',
            isPlaying ? 'text-accent' : 'text-faint/0 group-hover:text-faint'
          )}>
            {isPlaying
              ? <Square size={9} fill="currentColor" />
              : <Play  size={9} fill="currentColor" className="translate-x-px" />
            }
          </div>

          {isRenaming && canEdit ? (
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
              className="flex-1 min-w-0 bg-transparent border-0 border-b border-accent/40 outline-none text-[13px] text-ink py-0 px-0"
              autoFocus
            />
          ) : (
            <span className={cn('text-[13px] truncate min-w-0', isPlaying && 'text-ink font-medium')}>
              {item.name}
            </span>
          )}
          {/* Waveform miniature */}
          {waveformData && !isRenaming && (
            <svg viewBox="0 0 100 100" className="flex-1 h-4 min-w-0" preserveAspectRatio="none">
              {waveformData.map((v, i) => {
                const barW = 100 / waveformData.length
                const h = Math.max(2, v * 100)
                return (
                  <rect
                    key={i}
                    x={i * barW + 0.1}
                    width={barW - 0.2}
                    y={50 - h / 2}
                    height={h}
                    className={isPlaying ? 'fill-accent/60' : 'fill-[rgba(255,255,255,0.15)]'}
                  />
                )
              })}
            </svg>
          )}
        </div>

        {/* Duration */}
        <span className="text-[12px] text-faint tabular-nums text-right font-mono pr-1">
          {item.duration != null ? formatTime(item.duration) : '—'}
        </span>

        {/* BPM */}
        <span className="text-[12px] text-faint tabular-nums text-right font-mono pr-1">
          {item.bpm != null ? Math.round(item.bpm) : '—'}
        </span>

        {/* Key */}
        <span className="text-[12px] text-faint font-mono whitespace-nowrap">
          {item.musicalKey ?? '—'}
        </span>

        {/* Project */}
        <span className="text-[12px] text-faint/80 truncate pr-2">
          {project?.name ?? (item.kind === 'project-chop' ? item.projectName : '—')}
        </span>

        {/* Row actions */}
        {canEdit ? (
          <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <RowBtn icon={Pencil} title="Rename"    onClick={(e) => { e.stopPropagation(); startRename() }} />
            <RowBtn icon={Tag}    title="Edit tags" onClick={(e) => { e.stopPropagation(); setIsEditingTags(true) }} />
            <RowBtn icon={Trash2} title="Delete"    onClick={(e) => { e.stopPropagation(); onDeleteRequest() }} danger />
          </div>
        ) : (
          <span className="text-[10px] text-faint/50 text-right pr-1">Region</span>
        )}
      </div>

      {/* Tags — shown inline below the row */}
      {hasTags && !isRenaming && (
        <div className={cn(
          'flex items-center gap-1 px-11 pb-1.5 flex-wrap',
          striped ? 'bg-[rgba(255,255,255,0.015)]' : ''
        )}>
          {item.tags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={(e) => { e.stopPropagation(); onTagClick(tag) }}
              className="px-1.5 py-px rounded bg-accent/8 border border-accent/15 text-[10px] text-accent/60 hover:bg-accent/15 hover:text-accent/80 transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
          {item.tags.length > 5 && (
            <span className="text-[10px] text-faint/50">+{item.tags.length - 5}</span>
          )}
        </div>
      )}

      {item.kind === 'sample' && onTagsChange && (
        <TagDialog
          sample={item.sample}
          open={isEditingTags}
          onOpenChange={setIsEditingTags}
          onTagsChange={onTagsChange}
        />
      )}
    </>
  )
}

function RowBtn({ icon: Icon, title, onClick, danger }: {
  icon: React.ElementType
  title: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-6 h-6 flex items-center justify-center rounded-md bg-transparent border-0 cursor-pointer transition-colors text-faint hover:bg-raised',
        danger ? 'hover:text-red-400' : 'hover:text-ink'
      )}
    >
      <Icon size={12} />
    </button>
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
            <button className="text-faint hover:text-ink bg-transparent border-0 p-1 cursor-pointer transition-colors rounded-md">
              <X size={14} />
            </button>
          </DialogClose>
        </div>

        <div className="flex flex-wrap gap-2 min-h-8 mb-4">
          {tags.length === 0
            ? <p className="text-[12px] text-faint/60">No tags yet.</p>
            : tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent/80 text-[12px]">
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
            className="flex-1 bg-raised border border-border rounded-md px-3 h-8 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
          />
          <button
            onClick={() => addTag(input)}
            disabled={!input.trim()}
            className="px-3 h-8 rounded-md bg-accent text-white text-[12px] font-medium disabled:opacity-40 hover:bg-accent-bright transition-colors cursor-pointer border-0"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-faint/50 mt-2">Lowercase letters, numbers, hyphens and underscores only.</p>
      </DialogContent>
    </Dialog>
  )
}
