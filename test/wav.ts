import fs from 'node:fs'

export type WavInfo = {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataSize: number
  // Length in seconds derived from the PCM data chunk.
  duration: number
}

// Parse a PCM WAV file's fmt + data chunks. Enough to assert the format and length of a rendered clip.
export function readWavInfo(filePath: string): WavInfo {
  const buf = fs.readFileSync(filePath)
  let offset = 12 // skip RIFF header
  let fmt: Omit<WavInfo, 'dataSize' | 'duration'> | null = null
  let dataSize = 0

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(offset + 8),
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        bitsPerSample: buf.readUInt16LE(offset + 22),
      }
    } else if (id === 'data') {
      dataSize = size
    }
    offset += 8 + size + (size % 2)
  }

  if (!fmt) throw new Error('No fmt chunk found in WAV')
  const duration = dataSize / (fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8))
  return { ...fmt, dataSize, duration }
}
