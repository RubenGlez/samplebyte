import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { persistStems, getCachedStems, getModelFile } from './stems'
import { STEM_NAMES, type StemPcm } from '../../types'
import { readWavInfo } from '../../../test/wav'

// Small synthetic stereo PCM per stem (0.1s of a sine at 44.1k), enough to exercise the WAV
// encode + render-funnel normalization + cache lookup without any model inference.
function makeStems(): StemPcm[] {
  const n = 4410
  return STEM_NAMES.map((name, idx) => {
    const left = new Float32Array(n)
    const right = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      left[i] = 0.2 * Math.sin((2 * Math.PI * (110 + idx * 55) * i) / 44100)
      right[i] = left[i] * 0.9
    }
    return { name, sampleRate: 44100, left, right }
  })
}

// Valid SHA-256-shaped hashes (64 lowercase hex chars); the service rejects anything else (F31).
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)

describe('stems service', () => {
  it('persists each stem as a normalized LIBRARY_FORMAT WAV', async () => {
    const files = await persistStems(HASH_A, makeStems())
    expect(files.map((f) => f.name).sort()).toEqual([...STEM_NAMES].sort())
    for (const f of files) {
      expect(fs.existsSync(f.filePath)).toBe(true)
      const info = readWavInfo(f.filePath)
      expect(info.audioFormat).toBe(1) // PCM
      expect(info.sampleRate).toBe(44100)
      expect(info.channels).toBe(2)
      expect(info.bitsPerSample).toBe(16)
      expect(info.duration).toBeGreaterThan(0.05)
    }
  })

  it('returns the full cached set after persisting, and null otherwise', async () => {
    await persistStems(HASH_B, makeStems())
    const cached = getCachedStems(HASH_B)
    expect(cached).not.toBeNull()
    expect(cached!.map((f) => f.name).sort()).toEqual([...STEM_NAMES].sort())
    expect(getCachedStems(HASH_C)).toBeNull()
  })

  it('rejects a source hash that could escape the stems directory (F31)', async () => {
    expect(() => getCachedStems('../../etc')).toThrow(/invalid stem source hash/)
    await expect(persistStems('../../../etc/passwd', makeStems())).rejects.toThrow(/invalid stem source hash/)
    expect(() => getCachedStems('NOTHEX'.padEnd(64, 'g'))).toThrow(/invalid stem source hash/)
  })

  it('rejects unknown model file names', () => {
    expect(() => getModelFile('../secret.txt')).toThrow()
    expect(() => getModelFile('demucs.exe')).toThrow()
  })
})
