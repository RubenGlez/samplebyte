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
    <div className="flex flex-col gap-2 px-1">
      {/* macOS-style search field */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="w-full bg-raised border border-border rounded-md pl-7 pr-2.5 h-[26px] text-[12px] text-ink placeholder:text-faint/60 focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* Source segmented control */}
      <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
        {(['all', 'local', 'freesound'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSourceChange(s)}
            className={cn(
              'flex-1 h-[22px] rounded-[4px] text-[11px] font-medium transition-all cursor-pointer border-0 capitalize',
              source === s
                ? 'bg-[rgba(255,255,255,0.12)] text-ink'
                : 'text-faint/70 hover:text-muted bg-transparent'
            )}
          >
            {s === 'freesound' ? 'Free' : s}
          </button>
        ))}
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="relative">
          <FolderOpen size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <select
            value={projectFilter ?? ''}
            onChange={(e) => onProjectFilterChange(e.target.value || null)}
            className="w-full appearance-none bg-raised border border-border rounded-md pl-6 pr-5 h-[26px] text-[12px] text-ink focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
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

      {/* Tag pills */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer border',
                activeTags.includes(tag)
                  ? 'border-accent/40 text-accent/80 bg-accent/10'
                  : 'border-border text-faint hover:text-muted hover:border-border-bright bg-transparent'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
