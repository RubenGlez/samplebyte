import { useCallback, useRef } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import { timeToViewportX, viewportXToTime } from '@/lib/waveformCoords'
import { formatTime } from '@/utils'

interface TrimOverlayProps {
  wavesurfer: WaveSurfer
  duration: number
  trimIn: number
  trimOut: number
  onTrimInChange: (time: number) => void
  onTrimOutChange: (time: number) => void
  viewportTick: number
}

type DragHandle = 'in' | 'out'

export default function TrimOverlay({
  wavesurfer,
  duration,
  trimIn,
  trimOut,
  onTrimInChange,
  onTrimOutChange,
  viewportTick,
}: TrimOverlayProps) {
  void viewportTick

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragHandle | null>(null)

  const width = containerRef.current?.clientWidth ?? wavesurfer.getWidth()
  const inX = timeToViewportX(wavesurfer, trimIn, duration)
  const outX = timeToViewportX(wavesurfer, trimOut, duration)

  const startDrag = useCallback(
    (handle: DragHandle, e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = handle
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = viewportXToTime(wavesurfer, x, duration)
      if (dragRef.current === 'in') onTrimInChange(time)
      else onTrimOutChange(time)
    },
    [duration, onTrimInChange, onTrimOutChange, wavesurfer]
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  if (duration <= 0) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 pointer-events-none"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {inX > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 bg-base/70 pointer-events-none"
          style={{ width: inX }}
        />
      )}
      {outX < width && (
        <div
          className="absolute top-0 bottom-0 bg-base/70 pointer-events-none"
          style={{ left: outX, right: 0 }}
        />
      )}

      <TrimHandle
        label="In"
        time={trimIn}
        x={inX}
        labelSide="right"
        edge="left"
        onPointerDown={(e) => startDrag('in', e)}
      />
      <TrimHandle
        label="Out"
        time={trimOut}
        x={outX}
        labelSide="left"
        edge="right"
        onPointerDown={(e) => startDrag('out', e)}
      />
    </div>
  )
}

function TrimHandle({
  label,
  time,
  x,
  edge,
  labelSide = 'right',
  onPointerDown,
}: {
  label: string
  time: number
  x: number
  edge: 'left' | 'right'
  labelSide?: 'left' | 'right'
  onPointerDown: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className="absolute top-0 bottom-0 w-5 pointer-events-auto cursor-ew-resize group"
      style={{ left: x, transform: edge === 'left' ? 'translateX(0)' : 'translateX(-100%)' }}
      onPointerDown={onPointerDown}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-3 h-9 border border-sky-300/40 bg-sky-400/15 group-hover:bg-sky-400/25 ${
          edge === 'left'
            ? 'left-0 rounded-r-[4px] border-l-0'
            : 'right-0 rounded-l-[4px] border-r-0'
        }`}
      >
        <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-sky-300/70" />
      </div>
      <div className={`absolute inset-y-0 w-px bg-sky-400/90 group-hover:bg-sky-300 ${edge === 'left' ? 'left-0' : 'right-0'}`} />
      <span
        className={`absolute top-1 text-[9px] font-mono text-sky-300/90 whitespace-nowrap select-none pointer-events-none ${
          labelSide === 'left' ? 'right-3.5 text-right' : 'left-3.5'
        }`}
      >
        {label} {formatTime(time)}
      </span>
    </div>
  )
}
