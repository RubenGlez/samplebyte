// Main-thread facade for audio analysis. Decoding (AudioContext.decodeAudioData) must run here
// because it is unavailable to workers, but the CPU-bound DSP is delegated to audioAnalysis.worker
// so it never blocks the UI. Decoded buffers and analysis results are cached per URL so each file
// is decoded and analysed at most once.
import type { AnalysisResult, LoopCandidate } from './audioAnalysis.dsp'

export type { AnalysisResult, LoopCandidate }

// Shared buffer cache so analysis, transient detection, and loop finding all decode each URL
// exactly once. Bounded LRU: a decoded full track is tens of MB, so an unbounded cache would
// blow up memory during a folder import (every file retained at once). The interactive flow only
// touches one track at a time, so a small cap keeps reuse while letting old decodes get collected.
const MAX_CACHED_BUFFERS = 8
const bufferCache = new Map<string, Promise<AudioBuffer>>()

function getAudioBuffer(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) {
    // Re-insert so it counts as most-recently-used.
    bufferCache.delete(url)
    bufferCache.set(url, cached)
    return cached
  }

  const result = (async () => {
    const response = await fetch(url)
    const ab = await response.arrayBuffer()
    const ctx = new AudioContext()
    try {
      return await ctx.decodeAudioData(ab)
    } finally {
      ctx.close()
    }
  })()

  bufferCache.set(url, result)
  result.catch(() => bufferCache.delete(url))

  // Evict least-recently-used entries beyond the cap (Map preserves insertion order).
  while (bufferCache.size > MAX_CACHED_BUFFERS) {
    const oldest = bufferCache.keys().next().value
    if (oldest === undefined) break
    bufferCache.delete(oldest)
  }

  return result
}

// Copy each channel so the originals (backing the cached AudioBuffer) survive being transferred
// to the worker. Without the copy, transferring would detach the cached buffer's data.
function copyChannels(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice())
  }
  return channels
}

// Worker pool so a folder import can analyse files across several cores instead of one at a time.
// Workers are created lazily up to POOL_SIZE; each handles one task at a time and pulls the next
// queued task when it finishes. The interactive single-track flow only ever has one task in flight,
// so the pool costs nothing there.
type Task = {
  message: Record<string, unknown>
  channels: Float32Array[]
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

const POOL_SIZE = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2))
const poolWorkers: Array<{ worker: Worker; current: Task | null }> = []
const taskQueue: Task[] = []

function spawnWorker() {
  const slot: { worker: Worker; current: Task | null } = {
    worker: new Worker(new URL('../workers/audioAnalysis.worker.ts', import.meta.url), { type: 'module' }),
    current: null,
  }
  slot.worker.onmessage = (e: MessageEvent<{ id: string; result?: unknown; error?: string }>) => {
    const task = slot.current
    slot.current = null
    if (task) {
      if (e.data.error) task.reject(new Error(e.data.error))
      else task.resolve(e.data.result)
    }
    pump()
  }
  poolWorkers.push(slot)
  return slot
}

function pump() {
  if (taskQueue.length === 0) return
  let slot = poolWorkers.find((w) => w.current === null)
  if (!slot && poolWorkers.length < POOL_SIZE) slot = spawnWorker()
  if (!slot) return
  const task = taskQueue.shift()!
  slot.current = task
  slot.worker.postMessage(
    { id: crypto.randomUUID(), ...task.message, channels: task.channels },
    task.channels.map((ch) => ch.buffer)
  )
}

function runOnWorker<T>(message: Record<string, unknown>, channels: Float32Array[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    taskQueue.push({ message, channels, resolve: resolve as (value: unknown) => void, reject })
    pump()
  })
}

const analysisCache = new Map<string, Promise<AnalysisResult>>()

export function analyzeAudioUrl(url: string): Promise<AnalysisResult> {
  const cached = analysisCache.get(url)
  if (cached) return cached

  const result = getAudioBuffer(url).then((buffer) =>
    runOnWorker<AnalysisResult>({ kind: 'analyze', sampleRate: buffer.sampleRate }, copyChannels(buffer))
  )

  analysisCache.set(url, result)
  result.catch(() => analysisCache.delete(url))
  return result
}

export async function detectTransientsFromUrl(
  url: string,
  preset: 'coarse' | 'medium' | 'fine'
): Promise<number[]> {
  const buffer = await getAudioBuffer(url)
  return runOnWorker<number[]>({ kind: 'transients', sampleRate: buffer.sampleRate, preset }, copyChannels(buffer))
}

export async function findLoopCandidatesFromUrl(
  url: string,
  bpm: number,
  beatPhase: number,
  barCount: number
): Promise<LoopCandidate[]> {
  const buffer = await getAudioBuffer(url)
  return runOnWorker<LoopCandidate[]>(
    { kind: 'loops', sampleRate: buffer.sampleRate, bpm, beatPhase, barCount },
    copyChannels(buffer)
  )
}
