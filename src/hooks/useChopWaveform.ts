import { useEffect, useState } from 'react'
import { toLocalFileUrl } from '@/utils'

let sharedCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AudioContext()
  return sharedCtx
}

// Decoded buffers cached by URL — multiple chops from the same source file share one decode
const bufferCache = new Map<string, Promise<AudioBuffer>>()

function decodeUrl(url: string): Promise<AudioBuffer> {
  if (!bufferCache.has(url)) {
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => getCtx().decodeAudioData(ab))
    bufferCache.set(url, p)
    p.catch(() => bufferCache.delete(url))
  }
  return bufferCache.get(url)!
}

function peaksForRegion(buffer: AudioBuffer, start: number, end: number, bars = 100): number[] {
  const { sampleRate, numberOfChannels } = buffer
  const s = Math.floor(start * sampleRate)
  const e = Math.min(Math.floor(end * sampleRate), buffer.length)
  const step = Math.max(1, Math.floor((e - s) / bars))
  const peaks: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const fs = s + i * step
    const fe = Math.min(fs + step, e)
    for (let c = 0; c < numberOfChannels; c++) {
      const data = buffer.getChannelData(c)
      for (let f = fs; f < fe; f++) {
        const v = Math.abs(data[f])
        if (v > peak) peak = v
      }
    }
    peaks.push(peak)
  }
  return peaks
}

export function useChopWaveform(filePath: string | null, start: number, end: number): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    if (!filePath) return
    let cancelled = false

    decodeUrl(toLocalFileUrl(filePath))
      .then((buffer) => {
        if (!cancelled) setPeaks(peaksForRegion(buffer, start, end))
      })
      .catch(() => {
        if (!cancelled) setPeaks(null)
      })

    return () => { cancelled = true }
  }, [filePath, start, end])

  return peaks
}
