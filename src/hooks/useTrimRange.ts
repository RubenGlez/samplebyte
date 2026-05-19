import { useCallback, useEffect, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'

const MIN_TRIM_SECONDS = 1
const FULL_FILE_EPSILON = 0.05

export function useTrimRange(wavesurfer?: WaveSurfer) {
  const [trimIn, setTrimIn] = useState(0)
  const [trimOut, setTrimOut] = useState(0)
  const [duration, setDuration] = useState(0)
  const [viewportTick, setViewportTick] = useState(0)

  const bumpViewport = useCallback(() => setViewportTick((n) => n + 1), [])

  useEffect(() => {
    if (!wavesurfer) return

    const onReady = () => {
      const d = wavesurfer.getDuration()
      setDuration(d)
      setTrimIn(0)
      setTrimOut(d)
    }

    wavesurfer.on('ready', onReady)
    wavesurfer.on('scroll', bumpViewport)
    wavesurfer.on('zoom', bumpViewport)
    wavesurfer.on('resize', bumpViewport)

    if (wavesurfer.getDuration() > 0) onReady()

    return () => {
      wavesurfer.un('ready', onReady)
      wavesurfer.un('scroll', bumpViewport)
      wavesurfer.un('zoom', bumpViewport)
      wavesurfer.un('resize', bumpViewport)
    }
  }, [wavesurfer, bumpViewport])

  const trimDuration = trimOut - trimIn
  const spansFullFile =
    duration > 0 &&
    trimIn <= FULL_FILE_EPSILON &&
    trimOut >= duration - FULL_FILE_EPSILON

  const canApplyTrim =
    duration > 0 &&
    trimDuration >= MIN_TRIM_SECONDS &&
    !spansFullFile

  const setTrimInClamped = useCallback(
    (time: number) => {
      const next = Math.max(0, Math.min(time, trimOut - MIN_TRIM_SECONDS))
      setTrimIn(next)
    },
    [trimOut]
  )

  const setTrimOutClamped = useCallback(
    (time: number) => {
      const next = Math.min(duration, Math.max(time, trimIn + MIN_TRIM_SECONDS))
      setTrimOut(next)
    },
    [duration, trimIn]
  )

  return {
    trimIn,
    trimOut,
    trimDuration,
    duration,
    setTrimIn: setTrimInClamped,
    setTrimOut: setTrimOutClamped,
    canApplyTrim,
    viewportTick,
  }
}
