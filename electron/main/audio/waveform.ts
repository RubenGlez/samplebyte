import fs from 'node:fs'

type WavChunk = { dataOffset: number; dataSize: number; sampleRate: number; channels: number; bitsPerSample: number }

// Walk the RIFF chunk list, honouring the format's word-alignment (odd-size chunks are padded to an
// even boundary) so a stray odd chunk before 'data' can't desync the parser. Returns null when the
// file has no readable fmt/data pair rather than treating trailing garbage as samples (F10).
function parseWav(buf: Buffer): WavChunk | null {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null

  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let offset = 12
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    const body = offset + 8
    if (chunkId === 'fmt ' && body + 16 <= buf.length) {
      channels = buf.readUInt16LE(body + 2)
      sampleRate = buf.readUInt32LE(body + 4)
      bitsPerSample = buf.readUInt16LE(body + 14)
    } else if (chunkId === 'data') {
      const dataSize = Math.min(chunkSize, buf.length - body)
      if (!sampleRate || !channels || !bitsPerSample) return null
      return { dataOffset: body, dataSize, sampleRate, channels, bitsPerSample }
    }
    // Chunks are word-aligned: an odd size is followed by a single pad byte.
    offset = body + chunkSize + (chunkSize & 1)
  }
  return null
}

// Reads a s16 stereo WAV (as produced by renderClip in LIBRARY_FORMAT) and returns ~100 peak amplitude values.
export function extractWaveformData(filePath: string, bars = 100): number[] {
  const buf = fs.readFileSync(filePath)
  const wav = parseWav(buf)
  if (!wav) return new Array(bars).fill(0)

  const bytesPerFrame = 4 // s16 stereo
  const dataEnd = wav.dataOffset + wav.dataSize
  const totalFrames = Math.floor(wav.dataSize / bytesPerFrame)
  const framesPerBar = Math.max(1, Math.floor(totalFrames / bars))
  const result: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const start = wav.dataOffset + i * framesPerBar * bytesPerFrame
    const end = Math.min(start + framesPerBar * bytesPerFrame, dataEnd - 1)
    for (let j = start; j < end; j += 2) {
      const v = Math.abs(buf.readInt16LE(j)) / 32767
      if (v > peak) peak = v
    }
    result.push(peak)
  }

  return result
}

// Real decoded duration in seconds from the WAV header, so library samples record what was actually
// written rather than the requested trim span (F9). Returns null for an unreadable file.
export function readWavDuration(filePath: string): number | null {
  const wav = parseWav(fs.readFileSync(filePath))
  if (!wav) return null
  const bytesPerFrame = wav.channels * (wav.bitsPerSample / 8)
  if (bytesPerFrame <= 0) return null
  return wav.dataSize / bytesPerFrame / wav.sampleRate
}
