// Krumhansl-Schmuckler major/minor key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MAX_ANALYSIS_SECONDS = 30

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length
  const meanA = a.reduce((s, x) => s + x, 0) / n
  const meanB = b.reduce((s, x) => s + x, 0) / n
  let num = 0, denomA = 0, denomB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB
    num += da * db
    denomA += da * da
    denomB += db * db
  }
  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

// BPM via autocorrelation of onset-strength envelope (energy RMS differences).
// Lags covering 60–200 BPM are tested; the lag with the highest dot product wins.
// Returns { bpm, onset } so detectBeatPhase can reuse the envelope without recomputing.
function detectBpm(mono: Float32Array, sampleRate: number): { bpm: number; onset: number[] } {
  const HOP = 512
  const FRAME = 1024
  const limit = Math.min(mono.length, MAX_ANALYSIS_SECONDS * sampleRate)

  const energies: number[] = []
  for (let i = 0; i < limit - FRAME; i += HOP) {
    let sum = 0
    for (let j = 0; j < FRAME; j++) sum += mono[i + j] ** 2
    energies.push(Math.sqrt(sum / FRAME))
  }

  // Onset strength: positive first-order differences of energy envelope
  const onset: number[] = [0]
  for (let i = 1; i < energies.length; i++) {
    onset.push(Math.max(0, energies[i] - energies[i - 1]))
  }

  const frameRate = sampleRate / HOP
  const minLag = Math.round(frameRate * 60 / 200)
  const maxLag = Math.round(frameRate * 60 / 60)
  const N = onset.length

  let bestBpm = 120
  let bestScore = -Infinity

  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = 0; i < N - lag; i++) score += onset[i] * onset[i + lag]
    if (score > bestScore) {
      bestScore = score
      bestBpm = (60 * frameRate) / lag
    }
  }

  return { bpm: Math.round(bestBpm), onset }
}

// Beat phase: the time offset (seconds) of the first beat, found by summing onset
// strength at positions offset + k*period across all k and picking the offset that
// maximises the total. Reuses the onset envelope from detectBpm.
function detectBeatPhase(onset: number[], sampleRate: number, bpm: number): number {
  const HOP = 512
  const frameRate = sampleRate / HOP
  const period = Math.round(frameRate * 60 / bpm)
  if (period <= 0) return 0

  let bestPhase = 0
  let bestScore = -Infinity

  for (let phase = 0; phase < period; phase++) {
    let score = 0
    for (let k = phase; k < onset.length; k += period) score += onset[k]
    if (score > bestScore) { bestScore = score; bestPhase = phase }
  }

  return (bestPhase * HOP) / sampleRate
}

// Chroma via Goertzel DFT at each MIDI pitch (C2–B7), folded into 12 pitch classes.
// Downsampled first so the per-pitch DFT stays fast even on long files.
function extractChroma(mono: Float32Array, sampleRate: number): number[] {
  const limit = Math.min(mono.length, MAX_ANALYSIS_SECONDS * sampleRate)

  // Downsample to ~8820 Hz so Nyquist covers B7 (~3951 Hz)
  const factor = Math.max(1, Math.floor(sampleRate / 8820))
  const dsLen = Math.floor(limit / factor)
  const ds = new Float32Array(dsLen)
  for (let i = 0; i < dsLen; i++) {
    let sum = 0
    for (let j = 0; j < factor; j++) sum += mono[i * factor + j]
    ds[i] = sum / factor
  }
  const dsSr = sampleRate / factor

  const chroma = new Array<number>(12).fill(0)
  const WINDOW = Math.min(Math.floor(dsSr), ds.length)
  const HOP = Math.floor(WINDOW / 2)

  // Goertzel-style DFT at each chromatic pitch (MIDI 36–95 = C2–B7)
  for (let start = 0; start + WINDOW <= ds.length; start += HOP) {
    for (let midi = 36; midi <= 95; midi++) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const omega = (2 * Math.PI * freq) / dsSr
      const cosOmega = Math.cos(omega)
      const sinOmega = Math.sin(omega)
      let re = 0, im = 0
      let cosI = 1, sinI = 0
      for (let i = 0; i < WINDOW; i++) {
        re += ds[start + i] * cosI
        im += ds[start + i] * sinI
        const newCos = cosI * cosOmega - sinI * sinOmega
        sinI = sinI * cosOmega + cosI * sinOmega
        cosI = newCos
      }
      chroma[midi % 12] += Math.sqrt(re * re + im * im)
    }
  }

  const max = Math.max(...chroma)
  return max > 0 ? chroma.map((c) => c / max) : chroma
}

function detectKey(chroma: number[]): string {
  let bestKey = 'C major'
  let bestCorr = -Infinity

  for (let root = 0; root < 12; root++) {
    const rotated = [...chroma.slice(root), ...chroma.slice(0, root)]

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE)
    if (majorCorr > bestCorr) {
      bestCorr = majorCorr
      bestKey = `${NOTE_NAMES[root]} major`
    }

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE)
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr
      bestKey = `${NOTE_NAMES[root]} minor`
    }
  }

  return bestKey
}

// Returns null if the duration doesn't align within 5% of a bar to a common loop length.
function detectLoopBars(durationSeconds: number, bpm: number): number | null {
  if (bpm <= 0) return null
  const barLength = (60 / bpm) * 4
  const barsFloat = durationSeconds / barLength
  for (const n of [1, 2, 4, 8, 16]) {
    if (Math.abs(barsFloat - n) < 0.05) return n
  }
  return null
}

export function analyzeAudioBuffer(buffer: AudioBuffer): { bpm: number; musicalKey: string; beatPhase: number; loopBars: number | null } {
  // Mix down to mono
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) mono[i] += ch[i]
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels

  const { bpm, onset } = detectBpm(mono, buffer.sampleRate)
  const beatPhase = detectBeatPhase(onset, buffer.sampleRate, bpm)
  const chroma = extractChroma(mono, buffer.sampleRate)
  const musicalKey = detectKey(chroma)
  const loopBars = detectLoopBars(buffer.duration, bpm)

  return { bpm, musicalKey, beatPhase, loopBars }
}

// Shared buffer cache so analysis, transient detection, and loop finding
// all decode each URL exactly once.
const bufferCache = new Map<string, Promise<AudioBuffer>>()

function getAudioBuffer(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached

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
  return result
}

const analysisCache = new Map<string, Promise<{ bpm: number; musicalKey: string; beatPhase: number; loopBars: number | null }>>()

export function analyzeAudioUrl(url: string): Promise<{ bpm: number; musicalKey: string; beatPhase: number; loopBars: number | null }> {
  const cached = analysisCache.get(url)
  if (cached) return cached

  const result = getAudioBuffer(url).then(analyzeAudioBuffer)

  analysisCache.set(url, result)
  result.catch(() => analysisCache.delete(url))
  return result
}

// Radix-2 Cooley-Tukey in-place FFT. Input arrays must have power-of-2 length.
function fft(re: Float32Array, im: Float32Array): void {
  const N = re.length
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const angle = -2 * Math.PI / len
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0
      const half = len >> 1
      for (let j = 0; j < half; j++) {
        const ur = re[i + j], ui = im[i + j]
        const vr = re[i + j + half] * cr - im[i + j + half] * ci
        const vi = re[i + j + half] * ci + im[i + j + half] * cr
        re[i + j] = ur + vr; im[i + j] = ui + vi
        re[i + j + half] = ur - vr; im[i + j + half] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

// Onset strength via spectral flux: per-bin positive magnitude differences across
// consecutive STFT frames. Catches hi-hats and ghost notes that RMS energy smears over.
// Presets are producer-oriented (phrase/sample scale), not editor-microscopic:
//   coarse → large sections and dominant hits
//   medium → practical default chops
//   fine   → smaller hits, while still rejecting tiny fragments
// Spectral-flux onset envelope: one positive-flux value per STFT frame.
function onsetEnvelope(buffer: AudioBuffer): { onset: number[]; hop: number; sampleRate: number } {
  const HOP = 256
  const FFT_SIZE = 1024
  const { sampleRate } = buffer

  // Mix to mono
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) mono[i] += ch[i]
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels

  // Hann window (computed once)
  const hann = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FFT_SIZE)

  const numBins = FFT_SIZE >> 1
  const prevMags = new Float32Array(numBins)
  const onset: number[] = []
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)

  for (let frameStart = 0; frameStart + FFT_SIZE <= mono.length; frameStart += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[frameStart + i] * hann[i]
      im[i] = 0
    }
    fft(re, im)
    let flux = 0
    for (let k = 0; k < numBins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k])
      flux += Math.max(0, mag - prevMags[k])
      prevMags[k] = mag
    }
    onset.push(flux)
  }

  return { onset, hop: HOP, sampleRate }
}

export function detectTransients(
  buffer: AudioBuffer,
  preset: 'coarse' | 'medium' | 'fine' = 'medium'
): number[] {
  const { onset, hop, sampleRate } = onsetEnvelope(buffer)

  // Adaptive threshold: mean + K * std of non-zero onset values
  const nonzero = onset.filter((v) => v > 0)
  if (nonzero.length === 0) return []
  const mean = nonzero.reduce((a, b) => a + b, 0) / nonzero.length
  const std = Math.sqrt(nonzero.reduce((a, b) => a + (b - mean) ** 2, 0) / nonzero.length)
  const K = { coarse: 3.2, medium: 2.2, fine: 1.2 }[preset]
  const threshold = mean + std * K

  // Local maxima above threshold
  const peaks: number[] = []
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] > threshold && onset[i] >= onset[i - 1] && onset[i] >= onset[i + 1]) {
      peaks.push((i * hop) / sampleRate)
    }
  }

  // Enforce producer-usable spacing between chops
  const MIN_GAP = { coarse: 1.6, medium: 0.8, fine: 0.4 }[preset]
  const transients: number[] = []
  let lastTime = -Infinity
  for (const t of peaks) {
    if (t - lastTime >= MIN_GAP) {
      transients.push(t)
      lastTime = t
    }
  }

  return transients
}

export async function detectTransientsFromUrl(
  url: string,
  preset: 'coarse' | 'medium' | 'fine'
): Promise<number[]> {
  const buffer = await getAudioBuffer(url)
  return detectTransients(buffer, preset)
}

// Ranks every onset peak by spectral-flux strength (its "quality"), strongest first, while keeping
// no two peaks closer than minGap. This powers the chop-count slider: the top-N peaks are the N most
// prominent hits, so asking for N chops yields the N best cut points. Analyze once, slice top-N for free.
export function rankTransients(
  buffer: AudioBuffer,
  minGap = 0.12
): Array<{ time: number; strength: number }> {
  const { onset, hop, sampleRate } = onsetEnvelope(buffer)

  const nonzero = onset.filter((v) => v > 0)
  if (nonzero.length === 0) return []
  // Low noise floor: keep local maxima above the mean so we rank hits, not the noise floor.
  const mean = nonzero.reduce((a, b) => a + b, 0) / nonzero.length

  const peaks: Array<{ time: number; strength: number }> = []
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] > mean && onset[i] >= onset[i - 1] && onset[i] >= onset[i + 1]) {
      peaks.push({ time: (i * hop) / sampleRate, strength: onset[i] })
    }
  }

  // Greedy strength-first selection with a minimum gap, so each kept peak is the strongest in its
  // neighbourhood. Order-independent of N, so top-N is a stable ranking.
  peaks.sort((a, b) => b.strength - a.strength)
  const kept: Array<{ time: number; strength: number }> = []
  for (const peak of peaks) {
    if (kept.every((k) => Math.abs(peak.time - k.time) >= minGap)) kept.push(peak)
  }
  return kept
}

export async function rankTransientsFromUrl(
  url: string,
  minGap = 0.12
): Promise<Array<{ time: number; strength: number }>> {
  const buffer = await getAudioBuffer(url)
  return rankTransients(buffer, minGap)
}

// Scores a window [startSec, endSec] for loop suitability.
// Uses RMS energy consistency: a flat-energy loop scores near 1, a build/break scores near 0.
function scoreLoopCandidate(
  mono: Float32Array,
  sampleRate: number,
  startSec: number,
  endSec: number
): number {
  const HOP = 1024
  const FRAME = 2048
  const startSample = Math.round(startSec * sampleRate)
  const endSample = Math.round(endSec * sampleRate)

  if (startSample < 0 || endSample > mono.length) return 0

  const energies: number[] = []
  for (let i = startSample; i + FRAME <= endSample; i += HOP) {
    let sum = 0
    for (let j = 0; j < FRAME; j++) sum += mono[i + j] ** 2
    energies.push(Math.sqrt(sum / FRAME))
  }

  if (energies.length < 4) return 0

  const mean = energies.reduce((a, b) => a + b, 0) / energies.length
  if (mean < 0.002) return 0  // near-silent window

  const cv = Math.sqrt(energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length) / mean
  return Math.max(0, 1 - cv)
}

// Minimum loop-suitability score (0–1) for a window to be offered as a candidate.
// Below this the energy is too uneven to make a clean loop, so it is dropped rather
// than padding the list with weak matches.
const LOOP_MIN_SCORE = 0.5

// Returns bar-aligned windows scored by loop suitability, best first. The count is driven
// by quality, not a fixed cap: every window at or above minScore is returned, except that
// overlapping windows are de-duplicated (see below). As long as at least one non-silent window
// exists, the single best one is always returned even if it falls below minScore, so Auto-loop
// never comes back empty-handed on audible material.
//
// Windows step one bar at a time but span barCount bars, so neighbours overlap heavily and are
// near-duplicates of the same musical loop shifted by a bar. We keep the highest-scoring window
// in each overlapping cluster and drop the rest, which yields distinct loops and bounds the count
// to roughly trackLength / loopLength instead of one-per-bar.
export function findLoopCandidates(
  buffer: AudioBuffer,
  bpm: number,
  beatPhase: number,
  barCount: number,
  minScore = LOOP_MIN_SCORE
): Array<{ start: number; end: number; score: number }> {
  if (bpm <= 0) return []

  const barLength = (60 / bpm) * 4
  const windowDuration = barCount * barLength

  if (windowDuration >= buffer.duration) return []

  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) mono[i] += ch[i]
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels

  // All non-silent windows (score 0 means silent/empty), best first.
  const scored: Array<{ start: number; end: number; score: number }> = []

  for (let start = beatPhase; start + windowDuration <= buffer.duration - 0.01; start += barLength) {
    const end = start + windowDuration
    const score = scoreLoopCandidate(mono, buffer.sampleRate, start, end)
    if (score > 0) scored.push({ start, end, score })
  }

  scored.sort((a, b) => b.score - a.score)

  // Greedy non-overlap dedup: walking best-first, keep a window only if it does not overlap one
  // already kept. Because the list is score-sorted, each overlapping cluster is represented by its
  // highest-scoring window.
  const kept: Array<{ start: number; end: number; score: number }> = []
  for (const candidate of scored) {
    if (candidate.score < minScore) continue
    const overlaps = kept.some((k) => candidate.start < k.end && k.start < candidate.end)
    if (!overlaps) kept.push(candidate)
  }

  // Fall back to the single best window so audible material always yields at least one loop.
  return kept.length ? kept : scored.slice(0, 1)
}

export async function findLoopCandidatesFromUrl(
  url: string,
  bpm: number,
  beatPhase: number,
  barCount: number
): Promise<Array<{ start: number; end: number; score: number }>> {
  const buffer = await getAudioBuffer(url)
  return findLoopCandidates(buffer, bpm, beatPhase, barCount)
}

