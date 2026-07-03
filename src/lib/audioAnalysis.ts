// Main-thread facade for audio analysis. Decoding (AudioContext.decodeAudioData) must run here
// because it is unavailable to workers, but the CPU-bound DSP is delegated to audioAnalysis.worker
// so it never blocks the UI. Decoded buffers and analysis results are cached per URL so each file
// is decoded and analysed at most once.
import type { AnalysisResult, LoopCandidate, RankedPeak } from './audioAnalysis.dsp'
import { runOnWorker } from './audioAnalysis.pool'

export type { AnalysisResult, LoopCandidate, RankedPeak }

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

export async function rankTransientsFromUrl(url: string, minGap = 0.12): Promise<RankedPeak[]> {
  const buffer = await getAudioBuffer(url)
  return runOnWorker<RankedPeak[]>({ kind: 'rank', sampleRate: buffer.sampleRate, minGap }, copyChannels(buffer))
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
