// Pure audio-analysis DSP. Operates on raw channel arrays (no AudioBuffer / AudioContext /
// DOM), so it runs unchanged inside a Web Worker. Decoding stays on the main thread because
// AudioContext.decodeAudioData is not available to workers; only these CPU-bound loops are
// offloaded. The public facade in audioAnalysis.ts decodes, then posts channels here.

export type AnalysisResult = { bpm: number; musicalKey: string; beatPhase: number; loopBars: number | null }
export type LoopCandidate = { start: number; end: number; score: number }
// A chop is a fragment: a clean onset (in) and a natural decay (out), not a boundary. start/end
// bound the fragment; strength ranks it. Fragments never overlap and need not cover the whole track.
export type RankedPeak = { start: number; end: number; strength: number }

// Krumhansl-Schmuckler major/minor key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MAX_ANALYSIS_SECONDS = 30

// Mix all channels down to a single mono buffer.
function mixToMono(channels: Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const ch of channels) {
    for (let i = 0; i < length; i++) mono[i] += ch[i]
  }
  const n = channels.length || 1
  for (let i = 0; i < length; i++) mono[i] /= n
  return mono
}

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

export function analyzeChannels(channels: Float32Array[], sampleRate: number): AnalysisResult {
  const mono = mixToMono(channels)
  const duration = mono.length / sampleRate

  const { bpm, onset } = detectBpm(mono, sampleRate)
  const beatPhase = detectBeatPhase(onset, sampleRate, bpm)
  const chroma = extractChroma(mono, sampleRate)
  const musicalKey = detectKey(chroma)
  const loopBars = detectLoopBars(duration, bpm)

  return { bpm, musicalKey, beatPhase, loopBars }
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

// Spectral-flux onset envelope: one positive-flux value per STFT frame. Per-bin positive magnitude
// differences across consecutive frames catch hi-hats and ghost notes that RMS energy smears over.
function onsetEnvelope(channels: Float32Array[]): { onset: number[]; hop: number } {
  const HOP = 256
  const FFT_SIZE = 1024

  const mono = mixToMono(channels)

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

  return { onset, hop: HOP }
}

// Onset detection with producer-oriented presets (phrase/sample scale), not editor-microscopic:
//   coarse → large sections and dominant hits
//   medium → practical default chops
//   fine   → smaller hits, while still rejecting tiny fragments
export function detectTransients(
  channels: Float32Array[],
  sampleRate: number,
  preset: 'coarse' | 'medium' | 'fine' = 'medium'
): number[] {
  const { onset, hop } = onsetEnvelope(channels)

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

// Fragment shaping (seconds / fractions). A chop starts a hair before the onset so the attack isn't
// clipped. Length is oriented to a musical 2–5s: short sounds that fully decay before MIN_TARGET end
// at their decay; sustained material runs to a low-energy "breath" between MIN_TARGET and MAX_FRAGMENT.
const PRE_ROLL = 0.005
const MIN_TARGET = 2.0
const MAX_FRAGMENT = 5.0
const MIN_FRAGMENT = 0.05
const RELEASE = 0.03
const DECAY_THRESHOLD = 0.15

// Finds the organic end of a fragment starting at onsetTime, looking at most MAX_FRAGMENT ahead.
// A one-shot that decays below DECAY_THRESHOLD of its peak before MIN_TARGET ends at that decay;
// otherwise the cut is placed at the quietest frame in [MIN_TARGET, MAX_FRAGMENT] so sustained
// material ends on a natural dip rather than a hard slice. (Overlap with neighbouring chops is
// handled at selection time, not here.)
function fragmentEnd(
  mono: Float32Array,
  sampleRate: number,
  onsetTime: number,
  startTime: number
): number {
  const HOP = 1024
  const FRAME = 2048
  const maxEnd = Math.min(mono.length / sampleRate, onsetTime + MAX_FRAGMENT)
  const s = Math.floor(onsetTime * sampleRate)
  const e = Math.min(mono.length, Math.floor(maxEnd * sampleRate))
  const minEnd = Math.min(maxEnd, startTime + MIN_FRAGMENT)

  let peak = 0
  const rms: number[] = []
  const frameEnd: number[] = []
  for (let i = s; i + FRAME <= e; i += HOP) {
    let sum = 0
    for (let j = 0; j < FRAME; j++) sum += mono[i + j] * mono[i + j]
    const r = Math.sqrt(sum / FRAME)
    rms.push(r)
    frameEnd.push((i + FRAME) / sampleRate)
    if (r > peak) peak = r
  }
  if (rms.length === 0 || peak === 0) return minEnd

  // Natural decay end (last frame still above threshold, plus a release tail).
  const threshold = peak * DECAY_THRESHOLD
  let lastLoud = 0
  for (let k = 0; k < rms.length; k++) if (rms[k] >= threshold) lastLoud = k
  const decayEnd = frameEnd[lastLoud] + RELEASE
  if (decayEnd - onsetTime <= MIN_TARGET) return Math.max(minEnd, Math.min(maxEnd, decayEnd))

  // Sustained: end on the quietest breath in the target window.
  let breathIdx = -1
  let breathRms = Infinity
  for (let k = 0; k < rms.length; k++) {
    if (frameEnd[k] - onsetTime < MIN_TARGET) continue
    if (rms[k] < breathRms) { breathRms = rms[k]; breathIdx = k }
  }
  return Math.max(minEnd, Math.min(maxEnd, breathIdx >= 0 ? frameEnd[breathIdx] : maxEnd))
}

// Returns chop fragments ranked by onset strength, strongest first. Each fragment is a self-contained
// piece with a clean in (onset) and an organic out (decay), and fragments never overlap — so taking the
// top-N gives N good samples spread across the track without covering it edge to edge. Because each
// fragment's bounds are capped at the next *candidate* onset (not the next *selected* one), the bounds
// are independent of N: analyse once, take any top-N for free.
export function rankTransients(
  channels: Float32Array[],
  sampleRate: number,
  minGap = 0.12
): RankedPeak[] {
  const { onset, hop } = onsetEnvelope(channels)

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
  if (peaks.length === 0) return []

  // Greedy strength-first selection with a minimum gap, so each kept onset is the strongest in its
  // neighbourhood.
  const byStrength = [...peaks].sort((a, b) => b.strength - a.strength)
  const selected: Array<{ time: number; strength: number }> = []
  for (const peak of byStrength) {
    if (selected.every((s) => Math.abs(peak.time - s.time) >= minGap)) selected.push(peak)
  }

  // Each fragment's end follows the sound itself (decay or breath), not the next onset — neighbouring
  // chops don't truncate each other here. Overlap among the *selected* top-N is resolved at apply time.
  const mono = mixToMono(channels)
  const fragments: RankedPeak[] = selected.map((p) => {
    const start = Math.max(0, p.time - PRE_ROLL)
    const end = fragmentEnd(mono, sampleRate, p.time, start)
    return { start, end, strength: p.strength }
  })

  // Rank by strength so the slider's top-N are the strongest fragments.
  fragments.sort((a, b) => b.strength - a.strength)
  return fragments
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
  channels: Float32Array[],
  sampleRate: number,
  bpm: number,
  beatPhase: number,
  barCount: number,
  minScore = LOOP_MIN_SCORE
): LoopCandidate[] {
  if (bpm <= 0) return []

  const mono = mixToMono(channels)
  const duration = mono.length / sampleRate

  const barLength = (60 / bpm) * 4
  const windowDuration = barCount * barLength

  if (windowDuration >= duration) return []

  // All non-silent windows (score 0 means silent/empty), best first.
  const scored: LoopCandidate[] = []

  for (let start = beatPhase; start + windowDuration <= duration - 0.01; start += barLength) {
    const end = start + windowDuration
    const score = scoreLoopCandidate(mono, sampleRate, start, end)
    if (score > 0) scored.push({ start, end, score })
  }

  scored.sort((a, b) => b.score - a.score)

  // Greedy non-overlap dedup: walking best-first, keep a window only if it does not overlap one
  // already kept. Because the list is score-sorted, each overlapping cluster is represented by its
  // highest-scoring window.
  const kept: LoopCandidate[] = []
  for (const candidate of scored) {
    if (candidate.score < minScore) continue
    const overlaps = kept.some((k) => candidate.start < k.end && k.start < candidate.end)
    if (!overlaps) kept.push(candidate)
  }

  // Fall back to the single best window so audible material always yields at least one loop.
  return kept.length ? kept : scored.slice(0, 1)
}
