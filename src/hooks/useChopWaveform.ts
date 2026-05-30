import { useEffect, useState } from 'react'
import { toLocalFileUrl } from '@/utils'

// Shared AudioContext — reused across all hook instances
let sharedCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AudioContext()
  return sharedCtx
}

// Decoded buffers cached by URL so multiple chops from the same source file share one decode
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

// Single shared worker for all peak extraction — runs off the main thread
let worker: Worker | null = null
const pending = new Map<string, (peaks: number[]) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/waveformPeaks.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: string; peaks: number[] }>) => {
      const resolve = pending.get(e.data.id)
      if (resolve) {
        resolve(e.data.peaks)
        pending.delete(e.data.id)
      }
    }
  }
  return worker
}

function extractPeaks(buffer: AudioBuffer, start: number, end: number, bars = 100): Promise<number[]> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID()
    pending.set(id, resolve)

    const sr = buffer.sampleRate
    const s = Math.floor(start * sr)
    const e = Math.min(Math.floor(end * sr), buffer.length)

    // Slice only the region — avoids transferring the whole file and doesn't detach the cached buffer
    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c).slice(s, e))
    }

    getWorker().postMessage({ id, channels, bars }, channels.map((ch) => ch.buffer))
  })
}

export function useChopWaveform(filePath: string | null, start: number, end: number): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    if (!filePath) return
    let cancelled = false

    decodeUrl(toLocalFileUrl(filePath))
      .then((buffer) => extractPeaks(buffer, start, end))
      .then((p) => { if (!cancelled) setPeaks(p) })
      .catch(() => { if (!cancelled) setPeaks(null) })

    return () => { cancelled = true }
  }, [filePath, start, end])

  return peaks
}
