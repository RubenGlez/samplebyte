import { Search, FolderOpen, ChevronDown } from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'
import type { Project } from '../../electron/types'

interface FilterControlsProps {
  search: string
  onSearchChange: (v: string) => void
  source: 'all' | 'local' | 'freesound'
  onSourceChange: (v: 'all' | 'local' | 'freesound') => void
  projects: Project[]
  projectFilter: string | null
  onProjectFilterChange: (v: string | null) => void
  bpm?: number
  onBpmChange?: (v: number | undefined) => void
  musicalKey?: string
  onKeyChange?: (v: string | undefined) => void
}

export function FilterControls({
  search, onSearchChange,
  source, onSourceChange,
  projects, projectFilter, onProjectFilterChange,
  bpm, onBpmChange, musicalKey, onKeyChange,
}: FilterControlsProps) {
  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="w-full bg-raised border border-border rounded-md pl-7 pr-2.5 h-[26px] text-[12px] text-ink placeholder:text-faint/60 focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <Segmented
        size="sm"
        fullWidth
        value={source}
        onChange={onSourceChange}
        options={[
          { value: 'all', label: 'All' },
          { value: 'local', label: 'Local' },
          { value: 'freesound', label: 'Free' },
        ]}
      />

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

      {(onBpmChange || onKeyChange) && (
        <div className="grid grid-cols-2 gap-1.5">
          {onBpmChange && (
            <input
              type="number"
              min="1"
              value={bpm ?? ''}
              onChange={(e) => onBpmChange(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="BPM"
              className="bg-raised border border-border rounded-md px-2 h-[26px] text-[12px] text-ink placeholder:text-faint/60 focus:outline-none focus:border-accent/40 transition-colors"
            />
          )}
          {onKeyChange && (
            <input
              value={musicalKey ?? ''}
              onChange={(e) => onKeyChange(e.target.value.trim() || undefined)}
              placeholder="Key"
              className="bg-raised border border-border rounded-md px-2 h-[26px] text-[12px] text-ink placeholder:text-faint/60 focus:outline-none focus:border-accent/40 transition-colors"
            />
          )}
        </div>
      )}
    </div>
  )
}
