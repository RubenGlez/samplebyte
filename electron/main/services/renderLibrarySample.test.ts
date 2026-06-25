import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderLibrarySample } from './materializeChops'
import { readWavInfo } from '../../../test/wav'

const FIXTURE = fileURLToPath(new URL('../../../scripts/seed-audio/think-break.mp3', import.meta.url))

describe('renderLibrarySample', () => {
  it('renders a library-format WAV into the samples dir and reads its waveform', async () => {
    const result = await renderLibrarySample(FIXTURE, 0.25, 0.75)

    expect(fs.existsSync(result.filePath)).toBe(true)
    expect(path.dirname(result.filePath).endsWith('samples')).toBe(true)
    expect(result.duration).toBe(0.5)

    const info = readWavInfo(result.filePath)
    expect(info.sampleRate).toBe(44100)
    expect(info.bitsPerSample).toBe(16)
    expect(info.duration).toBeGreaterThan(0.45)
    expect(info.duration).toBeLessThan(0.55)

    // 100 normalized peak bars, each a real amplitude in [0, 1].
    expect(result.waveformData).toHaveLength(100)
    expect(Math.max(...result.waveformData)).toBeGreaterThan(0)
    expect(Math.max(...result.waveformData)).toBeLessThanOrEqual(1)
  })

  it('gives each render its own file', async () => {
    const a = await renderLibrarySample(FIXTURE, 0, 0.3)
    const b = await renderLibrarySample(FIXTURE, 0, 0.3)
    expect(a.filePath).not.toBe(b.filePath)
  })
})
