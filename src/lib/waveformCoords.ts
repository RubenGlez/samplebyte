import type WaveSurfer from 'wavesurfer.js'

export function getPxPerSec(wavesurfer: WaveSurfer, duration: number): number {
  if (duration <= 0) return 1
  const minPx = wavesurfer.options.minPxPerSec
  if (minPx && minPx > 0) return minPx
  return wavesurfer.getWrapper().scrollWidth / duration
}

/** X position in pixels relative to the visible waveform viewport. */
export function timeToViewportX(wavesurfer: WaveSurfer, time: number, duration: number): number {
  const pxPerSec = getPxPerSec(wavesurfer, duration)
  return time * pxPerSec - wavesurfer.getScroll()
}

export function viewportXToTime(wavesurfer: WaveSurfer, x: number, duration: number): number {
  const pxPerSec = getPxPerSec(wavesurfer, duration)
  const time = (wavesurfer.getScroll() + x) / pxPerSec
  return Math.max(0, Math.min(duration, time))
}
