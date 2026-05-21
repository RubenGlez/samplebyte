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
function detectBpm(mono: Float32Array, sampleRate: number): number {
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

  return Math.round(bestBpm)
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

export function analyzeAudioBuffer(buffer: AudioBuffer): { bpm: number; musicalKey: string } {
  // Mix down to mono
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) mono[i] += ch[i]
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels

  const bpm = detectBpm(mono, buffer.sampleRate)
  const chroma = extractChroma(mono, buffer.sampleRate)
  const musicalKey = detectKey(chroma)

  return { bpm, musicalKey }
}

const analysisCache = new Map<string, Promise<{ bpm: number; musicalKey: string }>>()

export function analyzeAudioUrl(url: string): Promise<{ bpm: number; musicalKey: string }> {
  const cached = analysisCache.get(url)
  if (cached) return cached

  const result = (async () => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const ctx = new AudioContext()
    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer)
      return analyzeAudioBuffer(buffer)
    } finally {
      ctx.close()
    }
  })()

  analysisCache.set(url, result)
  result.catch(() => analysisCache.delete(url))
  return result
}

// Onset strength is computed as positive first-order RMS energy differences.
// Local maxima above an adaptive threshold (mean + k*std of non-zero onsets)
// are returned as transient timestamps. k is tuned per preset:
//   coarse → fewer, dominant hits only
//   medium → balanced
//   fine   → catches subtle transients
export function detectTransients(
  buffer: AudioBuffer,
  preset: 'coarse' | 'medium' | 'fine' = 'medium'
): number[] {
  const HOP = 256
  const FRAME = 512
  const { sampleRate } = buffer

  // Mix to mono
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) mono[i] += ch[i]
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels

  // RMS energy per hop
  const energies: number[] = []
  for (let i = 0; i + FRAME < mono.length; i += HOP) {
    let sum = 0
    for (let j = 0; j < FRAME; j++) sum += mono[i + j] ** 2
    energies.push(Math.sqrt(sum / FRAME))
  }

  // Onset strength: positive first-order differences
  const onset: number[] = [0]
  for (let i = 1; i < energies.length; i++) {
    onset.push(Math.max(0, energies[i] - energies[i - 1]))
  }

  // Adaptive threshold: mean + k * std of non-zero onset values
  const nonzero = onset.filter((v) => v > 0)
  if (nonzero.length === 0) return []
  const mean = nonzero.reduce((a, b) => a + b, 0) / nonzero.length
  const std = Math.sqrt(nonzero.reduce((a, b) => a + (b - mean) ** 2, 0) / nonzero.length)
  const K = { coarse: 2.0, medium: 1.0, fine: 0.3 }[preset]
  const threshold = mean + std * K

  // Local maxima above threshold
  const peaks: number[] = []
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] > threshold && onset[i] >= onset[i - 1] && onset[i] >= onset[i + 1]) {
      peaks.push((i * HOP) / sampleRate)
    }
  }

  // Enforce 80 ms minimum gap between consecutive transients
  const MIN_GAP = 0.08
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
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    return detectTransients(buffer, preset)
  } finally {
    ctx.close()
  }
}
