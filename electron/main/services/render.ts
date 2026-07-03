import { configureFfmpeg, ffmpeg } from './ffmpeg'

// Configure the bundled ffmpeg binary once, here. render is the only module that drives ffmpeg, so
// every audio-producing path (library, packs, export) imports it and is configured by side effect.
configureFfmpeg()

// Container + PCM settings for a rendered file. A subset of HardwareProfile.format, so a profile can
// be passed straight through for hardware export.
export type RenderFormat = {
  container: 'wav' | 'aiff'
  sampleRate: number
  sampleFmt: string
}

// CD-quality stereo PCM: the canonical format for library samples and pad-owned pack audio. Hardware
// export renders at the per-profile format instead (see HardwareProfile.format).
export const LIBRARY_FORMAT: RenderFormat = { container: 'wav', sampleRate: 44100, sampleFmt: 's16' }

// Map the profile's PCM sample-format tag to a real ffmpeg encoder. `-sample_fmt s24` is NOT a valid
// ffmpeg option (there is no s24 packed sample format), which silently broke every 24-bit profile
// render; the correct 24-bit path is the pcm_s24le codec (F2). Selecting the codec also removes any
// dependence on ffmpeg's default codec per container.
const PCM_CODECS: Record<string, string> = {
  s16: 'pcm_s16le',
  s24: 'pcm_s24le',
  s32: 'pcm_s32le',
}

// Hard ceiling per clip so a corrupt input that makes ffmpeg hang can't leave a promise pending
// forever (F27). Generous enough for a long full-source conversion.
const RENDER_TIMEOUT_MS = 120_000

// Trim window into the source. Both null means render the whole source (a format conversion).
export type RenderRegion = { start: number | null; end: number | null }

// The one place that turns a source region into a real audio file. Every audio output in the app —
// library samples, pad-owned pack audio, and hardware export — renders through here, so the ffmpeg
// flags, the trim-window rule, and region validation live in a single function. Output is always
// stereo at the given format's sample rate and sample format.
export function renderClip(
  sourcePath: string,
  region: RenderRegion,
  outputPath: string,
  format: RenderFormat
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate the trim window here — the single funnel every render path flows through — so bad
    // bounds (NaN/Infinity/negative, end<=start) fail fast with a clear message instead of reaching
    // ffmpeg as an unparseable duration or being swallowed downstream (F28).
    if (region.start !== null || region.end !== null) {
      const { start, end } = region
      if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        reject(new Error(`Invalid trim window: start=${start}, end=${end}`))
        return
      }
    }

    const codec = PCM_CODECS[format.sampleFmt] ?? PCM_CODECS.s16
    const cmd = ffmpeg(sourcePath)
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (err) reject(err)
      else resolve()
    }

    if (region.start !== null && region.end !== null) {
      cmd.setStartTime(region.start).setDuration(region.end - region.start)
    }
    cmd
      .toFormat(format.container)
      .audioFrequency(format.sampleRate)
      .audioChannels(2)
      .audioCodec(codec)
      .output(outputPath)
      .on('end', () => finish())
      .on('error', (err) => finish(err instanceof Error ? err : new Error(String(err))))
      .run()

    timer = setTimeout(() => {
      try { cmd.kill('SIGKILL') } catch { /* already exited */ }
      finish(new Error(`ffmpeg render timed out after ${RENDER_TIMEOUT_MS}ms: ${sourcePath}`))
    }, RENDER_TIMEOUT_MS)
  })
}
