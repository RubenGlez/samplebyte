import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { type LibraryBrowserItem, useFilteredSamples } from '@/hooks/useFilteredSamples'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useChopWaveform } from '@/hooks/useChopWaveform'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import type { Project } from '@/types'

// Column layout — Name flex, then fixed narrow cols
const GRID = 'grid-cols-[1fr_120px_64px_52px_72px_140px]'

export default function LibraryView() {
  const { isLoading, fetchSamples, toggleTagFilter } = useLibraryStore()
  const { projects, fetchProjects } = useProjectsStore()

  useEffect(() => {
    fetchSamples()
    fetchProjects()
  }, [fetchSamples, fetchProjects])

  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]))
  const filtered = useFilteredSamples()

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
            <ColHeader label="" />
            <ColHeader label="Duration" right />
            <ColHeader label="BPM"      right />
            <ColHeader label="Key" />
            <ColHeader label="Project" />
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((item, i) => (
              <LibraryRow
                key={item.id}
                item={item}
                project={item.projectId ? projectsById[item.projectId] : undefined}
                striped={i % 2 === 1}
                onTagClick={toggleTagFilter}
              />
            ))}
          </div>
        </>
      )}
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
        <p className="text-[12px] text-faint/70 mt-1">Create regions in a project or import a folder using the sidebar</p>
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
  item, project, striped, onTagClick,
}: {
  item: LibraryBrowserItem
  project: Project | undefined
  striped: boolean
  onTagClick: (tag: string) => void
}) {
  const region = item.kind === 'project-chop' ? { start: item.start, end: item.end } : null
  const { isPlaying, toggle } = useAudioPlayer(toLocalFileUrl(item.filePath), region)

  const rowRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const chopWaveform = useChopWaveform(
    item.kind === 'project-chop' && inView ? item.filePath : null,
    item.kind === 'project-chop' ? item.start : 0,
    item.kind === 'project-chop' ? item.end : 0,
  )
  const waveformData = item.kind === 'sample' ? item.sample.waveformData : chopWaveform
  const hasTags = item.tags.length > 0

  return (
    <>
      <div
        ref={rowRef}
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
        onClick={toggle}
      >
        {/* Name + play indicator */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className={cn(
            'w-5 h-5 flex items-center justify-center rounded-full shrink-0 transition-colors',
            isPlaying ? 'text-accent' : 'text-faint/0 group-hover:text-faint'
          )}>
            {isPlaying
              ? <Square size={9} fill="currentColor" />
              : <Play   size={9} fill="currentColor" className="translate-x-px" />
            }
          </div>
          <span className={cn('text-[13px] truncate min-w-0', isPlaying && 'text-ink font-medium')}>
            {item.name}
          </span>
        </div>

        {/* Waveform */}
        <div className="flex items-center pr-2">
          {waveformData && (
            <svg viewBox="0 0 100 100" className="w-full h-4" preserveAspectRatio="none">
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
      </div>

      {/* Tags — shown inline below the row */}
      {hasTags && (
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
    </>
  )
}
