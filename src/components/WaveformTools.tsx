import { Crop, Layers, Library, Repeat, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import { STEM_ORDER, stemLabel } from '@/stores/stems'
import type { StemFile, StemName } from '@/types'
import {
  LOOP_BAR_OPTIONS,
  SLICE_OPTIONS,
  MIN_HIT_CHOPS,
  type ChopMethod,
  type LoopBarCount,
  type SliceCount,
  type WaveformTool,
} from './waveformTools.constants'

export type StemsStatus =
  | 'idle'
  | 'loading-model'
  | 'decoding'
  | 'separating'
  | 'persisting'
  | 'done'
  | 'error'

interface LoopToolProps {
  barCount: LoopBarCount
  setBarCount: (n: LoopBarCount) => void
  suggestedBars: number | null
  onFindLoops: () => void
  isSearching: boolean
  bpmReady: boolean
}

interface ChopToolProps {
  method: ChopMethod
  setMethod: (m: ChopMethod) => void
  // "Detect hits" — quality-ranked chop-count slider (live preview)
  chopCount: number
  maxChops: number
  setChopCount: (n: number) => void
  onChopSlideStart: () => void
  onChopSlideEnd: () => void
  isDetecting: boolean
  // "Equal slices"
  sliceCount: SliceCount
  setSliceCount: (n: SliceCount) => void
  onChop: () => void
  isChopping: boolean
  // shared
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
  bpmReady: boolean
}

interface TrimToolProps {
  trimIn: number
  trimOut: number
  trimDuration: number
  onTrim: () => void
  canApplyTrim: boolean
  canTrimFile: boolean
  isTrimming: boolean
}

interface StemsToolProps {
  status: StemsStatus
  progress: number
  error: string | null
  stems: StemFile[] | null
  selected: StemName | null
  canRun: boolean
  savingToLibrary: boolean
  onRun: () => void
  onCancel: () => void
  onSelect: (name: StemName) => void
  onRestore: () => void
  onSaveToLibrary: () => void
}

interface ToolContextBarProps {
  activeTool: WaveformTool | null
  loop: LoopToolProps
  chop: ChopToolProps
  trim: TrimToolProps
  stems: StemsToolProps
}

/** Small pill used inside option groups (loop length, sensitivity, slices). */
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-[11px] px-2.5 h-[22px] rounded-[4px] transition-all cursor-pointer border-0',
        active
          ? 'bg-[rgba(255,255,255,0.12)] text-ink'
          : 'text-faint/70 hover:text-muted bg-transparent'
      )}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-faint/60 select-none">{children}</span>
}

const TOOLS: { id: WaveformTool; label: string; title: string; Icon: typeof Repeat }[] = [
  { id: 'loop', label: 'Loop', title: 'Find clean loop points', Icon: Repeat },
  { id: 'chop', label: 'Chop', title: 'Slice into chops', Icon: Scissors },
  { id: 'trim', label: 'Trim', title: 'Keep only a selection', Icon: Crop },
  { id: 'stems', label: 'Stems', title: 'Split into instrument stems', Icon: Layers },
]

/**
 * Tool toolbar — discrete icon+label toggle buttons on the right of the transport row. Kept
 * visually distinct from the main Chop/Library/Packs tab nav (separate bordered buttons rather
 * than a connected segmented control) so the two don't read as competing navigation. Activating
 * a tool reveals its options in the ToolContextBar below.
 */
export function ToolSelector({
  activeTool,
  onSelectTool,
}: {
  activeTool: WaveformTool | null
  onSelectTool: (tool: WaveformTool) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {TOOLS.map(({ id, label, title, Icon }) => (
        <button
          key={id}
          onClick={() => onSelectTool(id)}
          title={title}
          aria-pressed={activeTool === id}
          className={cn(
            'flex items-center gap-1.5 h-[28px] px-2.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer border select-none',
            activeTool === id
              ? 'bg-accent/15 text-accent border-accent/40'
              : 'text-muted bg-transparent border-border hover:text-ink hover:border-border-bright'
          )}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}

/** Context bar — shows only the active tool's options. Renders nothing when no tool is active. */
export function ToolContextBar({ activeTool, loop, chop, trim, stems }: ToolContextBarProps) {
  if (!activeTool) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface shrink-0 min-h-[40px]">
      {activeTool === 'loop' && <LoopPanel {...loop} />}
      {activeTool === 'chop' && <ChopPanel {...chop} />}
      {activeTool === 'trim' && <TrimPanel {...trim} />}
      {activeTool === 'stems' && <StemsPanel {...stems} />}
    </div>
  )
}

function LoopPanel({ barCount, setBarCount, suggestedBars, onFindLoops, isSearching, bpmReady }: LoopToolProps) {
  return (
    <>
      <span className="text-[11px] text-faint/70 select-none">
        Finds clean loop points that line up with the beat.
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <FieldLabel>Loop length</FieldLabel>
        <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
          {LOOP_BAR_OPTIONS.map((n) => (
            <Pill key={n} active={barCount === n} onClick={() => setBarCount(n)}>
              {n} {n === '1' ? 'bar' : 'bars'}
              {suggestedBars !== null && Number(n) === suggestedBars && (
                <span className="ml-1 text-accent/70">★</span>
              )}
            </Pill>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={onFindLoops} disabled={isSearching || !bpmReady}>
          <Repeat size={12} />
          {isSearching ? 'Searching…' : 'Find loops'}
        </Button>
        {!bpmReady && <span className="text-[11px] text-faint/50 select-none">Detecting tempo…</span>}
      </div>
    </>
  )
}

function ChopPanel({
  method,
  setMethod,
  chopCount,
  maxChops,
  setChopCount,
  onChopSlideStart,
  onChopSlideEnd,
  isDetecting,
  sliceCount,
  setSliceCount,
  snapEnabled,
  setSnapEnabled,
  onChop,
  isChopping,
  bpmReady,
}: ChopToolProps) {
  return (
    <>
      {/* Method toggle */}
      <FieldLabel>Method</FieldLabel>
      <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
        <Pill active={method === 'hits'} onClick={() => setMethod('hits')}>Detect hits</Pill>
        <Pill active={method === 'slices'} onClick={() => setMethod('slices')}>Equal slices</Pill>
      </div>

      <div className="w-px h-4 bg-border" />

      {method === 'hits' ? (
        <div className="flex items-center gap-2.5">
          {isDetecting ? (
            <FieldLabel>Analyzing hits…</FieldLabel>
          ) : maxChops < MIN_HIT_CHOPS ? (
            <FieldLabel>No hits detected in selection</FieldLabel>
          ) : (
            <>
              <FieldLabel>Chops</FieldLabel>
              <input
                type="range"
                min={MIN_HIT_CHOPS}
                max={maxChops}
                value={chopCount}
                onPointerDown={onChopSlideStart}
                onPointerUp={onChopSlideEnd}
                onChange={(e) => setChopCount(Number(e.target.value))}
                style={{ accentColor: 'var(--color-accent)' }}
                className="w-44 cursor-pointer"
              />
              <span className="text-[12px] text-ink font-mono tabular-nums w-6 text-right">{chopCount}</span>
              <span className="text-[11px] text-faint/50 select-none">strongest hits first</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <FieldLabel>Cuts the selection into equal pieces</FieldLabel>
          <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
            {SLICE_OPTIONS.map((n) => (
              <Pill key={n} active={sliceCount === n} onClick={() => setSliceCount(n)}>
                {n}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={() => bpmReady && setSnapEnabled(!snapEnabled)}
          disabled={!bpmReady}
          className={cn(
            'flex items-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-0 select-none',
            bpmReady ? 'text-muted hover:text-ink' : 'text-faint/40 cursor-not-allowed'
          )}
        >
          <span
            className={cn(
              'w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors',
              snapEnabled && bpmReady
                ? 'bg-accent border-accent text-white'
                : 'border-border-bright bg-transparent'
            )}
          >
            {snapEnabled && bpmReady && '✓'}
          </span>
          Snap to beat{!bpmReady && ' (needs tempo)'}
        </button>
        {method === 'slices' && (
          <Button variant="outline" size="sm" onClick={onChop} disabled={isChopping}>
            <Scissors size={12} />
            {isChopping ? 'Chopping…' : 'Chop'}
          </Button>
        )}
      </div>
    </>
  )
}

const STEMS_RUNNING: StemsStatus[] = ['loading-model', 'decoding', 'separating', 'persisting']

function StemsPanel({
  status,
  progress,
  error,
  stems,
  selected,
  canRun,
  savingToLibrary,
  onRun,
  onCancel,
  onSelect,
  onRestore,
  onSaveToLibrary,
}: StemsToolProps) {
  const running = STEMS_RUNNING.includes(status)
  const pct = Math.round(progress * 100)

  if (running) {
    const text =
      status === 'loading-model' ? 'Loading model…'
      : status === 'decoding' ? 'Decoding audio…'
      : status === 'persisting' ? 'Saving stems…'
      : `Separating… ${pct}%`
    return (
      <>
        <FieldLabel>{text}</FieldLabel>
        <div className="flex-1 max-w-[280px] h-[6px] rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <span className="text-[11px] text-faint/50 select-none">Runs locally · can take a few minutes</span>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </>
    )
  }

  if (status === 'done' && stems) {
    return (
      <>
        <FieldLabel>Stem</FieldLabel>
        <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
          <Pill active={selected === null} onClick={onRestore}>Full mix</Pill>
          {STEM_ORDER.filter((name) => stems.some((s) => s.name === name)).map((name) => (
            <Pill key={name} active={selected === name} onClick={() => onSelect(name)}>
              {stemLabel(name)}
            </Pill>
          ))}
        </div>
        <span className="text-[11px] text-faint/50 select-none">“Other” = piano, guitar, strings, synths</span>
        <div className="flex items-center gap-2 ml-auto">
          {selected && (
            <Button variant="outline" size="sm" onClick={onSaveToLibrary} disabled={savingToLibrary}>
              <Library size={12} />
              {savingToLibrary ? 'Saving…' : `Add ${stemLabel(selected)} to Library`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRun}>
            <Layers size={12} />
            Re-run
          </Button>
        </div>
      </>
    )
  }

  // idle / error
  return (
    <>
      <span className="text-[11px] text-faint/70 select-none">
        Splits the audio into Drums, Bass, Vocals, and Other — then chop any stem on its own.
      </span>
      {error && <span className="text-[11px] text-red-400 select-none">{error}</span>}
      <div className="ml-auto">
        <Button variant="outline" size="sm" onClick={onRun} disabled={!canRun} title={!canRun ? 'Load a source first' : undefined}>
          <Layers size={12} />
          {error ? 'Try again' : 'Separate stems'}
        </Button>
      </div>
    </>
  )
}

function TrimPanel({ trimIn, trimOut, trimDuration, onTrim, canApplyTrim, canTrimFile, isTrimming }: TrimToolProps) {
  return (
    <>
      <span className="text-[11px] text-faint/70 select-none">Keeps only the selected part of the audio.</span>
      <div className="flex items-center gap-3 ml-auto">
        <span className="text-[11px] text-faint/70 font-mono select-none tabular-nums">
          {formatTime(trimIn)} – {formatTime(trimOut)} ({formatTime(trimDuration)})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onTrim}
          disabled={!canApplyTrim || !canTrimFile || isTrimming}
          title={!canTrimFile ? 'Save file to disk before trimming' : undefined}
        >
          <Crop size={12} />
          {isTrimming ? 'Trimming…' : 'Trim to selection'}
        </Button>
      </div>
    </>
  )
}
