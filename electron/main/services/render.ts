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

// Trim window into the source. Both null means render the whole source (a format conversion).
export type RenderRegion = { start: number | null; end: number | null }

// The one place that turns a source region into a real audio file. Every audio output in the app —
// library samples, pad-owned pack audio, and hardware export — renders through here, so the ffmpeg
// flags and the trim-window rule live in a single function. Output is always stereo at the given
// format's sample rate and sample format.
export function renderClip(
  sourcePath: string,
  region: RenderRegion,
  outputPath: string,
  format: RenderFormat
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(sourcePath)
    if (region.start !== null && region.end !== null) {
      cmd.setStartTime(region.start).setDuration(region.end - region.start)
    }
    cmd
      .toFormat(format.container)
      .audioFrequency(format.sampleRate)
      .audioChannels(2)
      .outputOptions([`-sample_fmt ${format.sampleFmt}`])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}
