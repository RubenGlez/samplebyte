import fs from 'node:fs'

// Reads a s16 stereo WAV (as produced by renderClip in LIBRARY_FORMAT) and returns ~100 peak amplitude values.
export function extractWaveformData(filePath: string, bars = 100): number[] {
  const buf = fs.readFileSync(filePath)

  // Walk chunks to find 'data'
  let offset = 12
  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    if (chunkId === 'data') { offset += 8; break }
    offset += 8 + chunkSize
  }

  const bytesPerFrame = 4 // s16 stereo
  const totalFrames = Math.floor((buf.length - offset) / bytesPerFrame)
  const framesPerBar = Math.max(1, Math.floor(totalFrames / bars))
  const result: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const start = offset + i * framesPerBar * bytesPerFrame
    const end = Math.min(start + framesPerBar * bytesPerFrame, buf.length - 1)
    for (let j = start; j < end; j += 2) {
      const v = Math.abs(buf.readInt16LE(j)) / 32767
      if (v > peak) peak = v
    }
    result.push(peak)
  }

  return result
}
