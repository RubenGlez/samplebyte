import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderClip, LIBRARY_FORMAT } from './render'
import { readWavInfo } from '../../../test/wav'

const FIXTURE = fileURLToPath(new URL('../../../scripts/seed-audio/amen-break.mp3', import.meta.url))

let tmpDir: string
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-test-'))
})
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('renderClip', () => {
  it('renders the whole source in LIBRARY_FORMAT when the region is unbounded', async () => {
    const out = path.join(tmpDir, 'full.wav')
    await renderClip(FIXTURE, { start: null, end: null }, out, LIBRARY_FORMAT)

    expect(fs.existsSync(out)).toBe(true)
    const info = readWavInfo(out)
    expect(info.audioFormat).toBe(1) // PCM
    expect(info.sampleRate).toBe(44100)
    expect(info.channels).toBe(2)
    expect(info.bitsPerSample).toBe(16) // s16
    // The amen break fixture is several seconds long; a full render keeps real content.
    expect(info.duration).toBeGreaterThan(1)
  })

  it('trims to the requested window', async () => {
    const out = path.join(tmpDir, 'trim.wav')
    await renderClip(FIXTURE, { start: 0.5, end: 1.0 }, out, LIBRARY_FORMAT)

    const info = readWavInfo(out)
    expect(info.duration).toBeGreaterThan(0.45)
    expect(info.duration).toBeLessThan(0.55)
  })

  it('honors a non-library format (sample rate + container)', async () => {
    const out = path.join(tmpDir, '48k.wav')
    await renderClip(FIXTURE, { start: 0, end: 0.5 }, out, {
      container: 'wav',
      sampleRate: 48000,
      sampleFmt: 's16',
    })

    expect(readWavInfo(out).sampleRate).toBe(48000)
  })

  it('renders 24-bit PCM (s24) via the pcm_s24le codec', async () => {
    // Regression for F2: `-sample_fmt s24` is not a valid ffmpeg option, so 24-bit profiles used to
    // fail every render. renderClip must map s24 -> pcm_s24le and produce a real 24-bit WAV.
    const out = path.join(tmpDir, '24bit.wav')
    await renderClip(FIXTURE, { start: 0, end: 0.5 }, out, {
      container: 'wav',
      sampleRate: 44100,
      sampleFmt: 's24',
    })

    const info = readWavInfo(out)
    // 24-bit PCM is written as WAVE_FORMAT_EXTENSIBLE (0xFFFE), not plain PCM (1); both are PCM.
    expect([1, 0xfffe]).toContain(info.audioFormat)
    expect(info.bitsPerSample).toBe(24)
  })

  it('rejects an invalid trim window before spawning ffmpeg', async () => {
    const out = path.join(tmpDir, 'bad.wav')
    await expect(
      renderClip(FIXTURE, { start: 1, end: 0.5 }, out, LIBRARY_FORMAT)
    ).rejects.toThrow(/Invalid trim window/)
    await expect(
      renderClip(FIXTURE, { start: 0, end: Number.NaN }, out, LIBRARY_FORMAT)
    ).rejects.toThrow(/Invalid trim window/)
  })

  it('rejects when the source does not exist', async () => {
    const out = path.join(tmpDir, 'never.wav')
    await expect(
      renderClip(path.join(tmpDir, 'missing.mp3'), { start: null, end: null }, out, LIBRARY_FORMAT)
    ).rejects.toBeDefined()
  })
})
