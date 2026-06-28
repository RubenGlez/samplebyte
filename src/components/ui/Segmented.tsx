import { cn } from '@/lib/utils'

// One segmented-control primitive for every exclusive 2–3 option choice in the app. Replaces the
// hand-rolled pill groups that had drifted to four different heights and two track alphas. Two
// tones: `neutral` (white-alpha active fill, for view/mode toggles) and `accent` (orange-tint
// active, for filter-style choices). Compose `SegmentedTrack` + `Pill` directly when an option
// needs custom children (e.g. a ★ marker); use `Segmented` for the common label-only case.

type Size = 'sm' | 'md'
type Tone = 'neutral' | 'accent'

const TRACK_SIZE: Record<Size, string> = {
  sm: 'p-[2px] rounded-[6px]',
  md: 'p-[3px] rounded-[8px]',
}

const PILL_SIZE: Record<Size, string> = {
  sm: 'h-[22px] px-2.5 rounded-[4px] text-[11px]',
  md: 'h-[26px] px-3.5 rounded-[5px] text-[12px]',
}

export function SegmentedTrack({
  size = 'md',
  className,
  children,
}: {
  size?: Size
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex items-center bg-[rgba(255,255,255,0.06)]', TRACK_SIZE[size], className)}>
      {children}
    </div>
  )
}

export function Pill({
  active,
  onClick,
  size = 'md',
  tone = 'neutral',
  title,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  size?: Size
  tone?: Tone
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'flex items-center font-medium transition-all duration-150 cursor-pointer border-0 select-none whitespace-nowrap',
        PILL_SIZE[size],
        active
          ? tone === 'accent'
            ? 'bg-accent/20 text-accent'
            : 'bg-[rgba(255,255,255,0.13)] text-ink'
          : 'text-muted hover:text-ink bg-transparent',
        className
      )}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  tone = 'neutral',
  fullWidth = false,
  className,
}: {
  options: { value: T; label: string; title?: string }[]
  value: T
  onChange: (value: T) => void
  size?: Size
  tone?: Tone
  // Stretch segments to fill the track width in equal parts (for sidebar filters that span a column).
  fullWidth?: boolean
  className?: string
}) {
  return (
    <SegmentedTrack size={size} className={cn(fullWidth && 'w-full', className)}>
      {options.map((opt) => (
        <Pill
          key={opt.value}
          active={value === opt.value}
          onClick={() => onChange(opt.value)}
          size={size}
          tone={tone}
          title={opt.title}
          className={fullWidth ? 'flex-1 justify-center px-0' : undefined}
        >
          {opt.label}
        </Pill>
      ))}
    </SegmentedTrack>
  )
}
