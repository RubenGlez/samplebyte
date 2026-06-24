import { Crop, Repeat, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils'
import {
  LOOP_BAR_OPTIONS,
  SLICE_OPTIONS,
  SENSITIVITY_LABELS,
  type ChopMethod,
  type HitSensitivity,
  type LoopBarCount,
  type SliceCount,
  type WaveformTool,
} from './waveformTools.constants'

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
  sensitivity: HitSensitivity
  setSensitivity: (s: HitSensitivity) => void
  sliceCount: SliceCount
  setSliceCount: (n: SliceCount) => void
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
  onChop: () => void
  isChopping: boolean
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

interface ToolContextBarProps {
  activeTool: WaveformTool | null
  loop: LoopToolProps
  chop: ChopToolProps
  trim: TrimToolProps
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

const TOOLS: { id: WaveformTool; label: string; Icon: typeof Repeat }[] = [
  { id: 'loop', label: 'Loop', Icon: Repeat },
  { id: 'chop', label: 'Chop', Icon: Scissors },
  { id: 'trim', label: 'Trim', Icon: Crop },
]

/** Tool selector — sits on the right side of the transport row. */
export function ToolSelector({
  activeTool,
  onSelectTool,
}: {
  activeTool: WaveformTool | null
  onSelectTool: (tool: WaveformTool) => void
}) {
  return (
    <div className="flex items-center p-[3px] rounded-[8px] bg-[rgba(255,255,255,0.05)]">
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onSelectTool(id)}
          className={cn(
            'flex items-center gap-1.5 h-[24px] px-3 rounded-[5px] text-[12px] font-medium transition-all cursor-pointer border-0 select-none',
            activeTool === id
              ? 'bg-[rgba(255,255,255,0.13)] text-ink'
              : 'text-muted hover:text-ink bg-transparent'
          )}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}

/** Context bar — shows only the active tool's options. Renders nothing when no tool is active. */
export function ToolContextBar({ activeTool, loop, chop, trim }: ToolContextBarProps) {
  if (!activeTool) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-base/40 shrink-0 min-h-[40px]">
      {activeTool === 'loop' && <LoopPanel {...loop} />}
      {activeTool === 'chop' && <ChopPanel {...chop} />}
      {activeTool === 'trim' && <TrimPanel {...trim} />}
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
  sensitivity,
  setSensitivity,
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
        <div className="flex items-center gap-2">
          <FieldLabel>Finds drum hits / note onsets</FieldLabel>
          <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
            {(['coarse', 'medium', 'fine'] as const).map((s) => (
              <Pill key={s} active={sensitivity === s} onClick={() => setSensitivity(s)}>
                {SENSITIVITY_LABELS[s]}
              </Pill>
            ))}
          </div>
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
        <Button variant="outline" size="sm" onClick={onChop} disabled={isChopping}>
          <Scissors size={12} />
          {isChopping ? 'Chopping…' : 'Chop'}
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
