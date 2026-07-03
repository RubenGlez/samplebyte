import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderClip, LIBRARY_FORMAT } from '../services/render'
import { extractWaveformData, readWavDuration } from './waveform'
import { readWavInfo } from '../../../test/wav'

const FIXTURE = fileURLToPath(new URL('../../../scripts/seed-audio/amen-break.mp3', import.meta.url))

let tmpDir: string
let clip: string
beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waveform-test-'))
  clip = path.join(tmpDir, 'clip.wav')
  await renderClip(FIXTURE, { start: 0.25, end: 0.75 }, clip, LIBRARY_FORMAT)
})
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('readWavDuration', () => {
  it('matches the real decoded length from the header (F9)', () => {
    const duration = readWavDuration(clip)
    expect(duration).not.toBeNull()
    // Agrees with the independent test parser rather than the requested trim span.
    expect(duration!).toBeCloseTo(readWavInfo(clip).duration, 3)
  })

  it('returns null for a non-WAV file', () => {
    const junk = path.join(tmpDir, 'junk.bin')
    fs.writeFileSync(junk, Buffer.from('not a wav file at all'))
    expect(readWavDuration(junk)).toBeNull()
  })
})

describe('extractWaveformData', () => {
  it('returns the requested number of bars for a real clip', () => {
    const bars = extractWaveformData(clip, 100)
    expect(bars).toHaveLength(100)
    expect(bars.some((b) => b > 0)).toBe(true)
  })

  it('returns zeros (not garbage) when there is no data chunk (F10)', () => {
    const junk = path.join(tmpDir, 'nodata.bin')
    fs.writeFileSync(junk, Buffer.from('garbage bytes with no riff header'))
    expect(extractWaveformData(junk, 8)).toEqual(new Array(8).fill(0))
  })
})
