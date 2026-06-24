import { useCallback, useEffect, useRef } from 'react'
import type WaveSurfer from 'wavesurfer.js'

interface Playable {
  start: number
  end: number
  play: (stopAtEnd?: boolean) => void
}

// wavesurfer's region.play has no loop mode (play(true) just stops at the region end),
// so looping is implemented here: keep the active region's bounds and seek back to its
// start whenever playback reaches the end. The loop is cleared on pause so resuming or
// playing the whole track does not keep yanking the cursor back.
export const useLoopPlayback = (wavesurfer?: WaveSurfer) => {
  const loopBoundsRef = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    if (!wavesurfer) return
    const onTime = (time: number) => {
      const bounds = loopBoundsRef.current
      if (bounds && time >= bounds.end - 0.005) wavesurfer.setTime(bounds.start)
    }
    const onPause = () => {
      loopBoundsRef.current = null
    }
    const subs = [wavesurfer.on('timeupdate', onTime), wavesurfer.on('pause', onPause)]
    return () => subs.forEach((unsub) => unsub())
  }, [wavesurfer])

  const playLooping = useCallback((region: Playable) => {
    loopBoundsRef.current = { start: region.start, end: region.end }
    region.play(false)
  }, [])

  const playOnce = useCallback((region: Playable) => {
    loopBoundsRef.current = null
    region.play(true)
  }, [])

  const stopLoop = useCallback(() => {
    loopBoundsRef.current = null
  }, [])

  return { playLooping, playOnce, stopLoop }
}
