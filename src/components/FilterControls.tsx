import { Search, FolderOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '../../electron/types'

interface FilterControlsProps {
  search: string
  onSearchChange: (v: string) => void
  source: 'all' | 'local' | 'freesound'
  onSourceChange: (v: 'all' | 'local' | 'freesound') => void
  projects: Project[]
  projectFilter: string | null
  onProjectFilterChange: (v: string | null) => void
  allTags: string[]
  activeTags: string[]
  onTagToggle: (tag: string) => void
}

export function FilterControls({
  search, onSearchChange,
  source, onSourceChange,
  projects, projectFilter, onProjectFilterChange,
  allTags, activeTags, onTagToggle,
}: FilterControlsProps) {
  return (
    <>
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="w-full bg-raised border border-border rounded pl-7 pr-2 h-7 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <div className="flex gap-1">
        {(['all', 'local', 'freesound'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSourceChange(s)}
            className={cn(
              'flex-1 h-6 rounded text-[10px] font-medium transition-colors bg-transparent border cursor-pointer capitalize font-brand',
              source === s
                ? 'border-accent/40 text-accent bg-accent/10'
                : 'border-border text-faint hover:text-muted hover:border-border-bright'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {projects.length > 0 && (
        <div className="relative">
          <FolderOpen size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <select
            value={projectFilter ?? ''}
            onChange={(e) => onProjectFilterChange(e.target.value || null)}
            className="w-full appearance-none bg-raised border border-border rounded pl-7 pr-5 h-7 text-xs text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="__none__">No project</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer border bg-transparent',
                activeTags.includes(tag)
                  ? 'border-accent/40 text-accent bg-accent/10'
                  : 'border-border text-faint hover:text-muted hover:border-border-bright'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
