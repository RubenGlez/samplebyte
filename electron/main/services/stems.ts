import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { renderClip, LIBRARY_FORMAT } from './render'
import { STEM_NAMES, type StemName, type StemPcm, type StemFile } from '../../types'

// The vendored demucs artifacts live under public/ (dev) / dist/ (packaged); process.env.VITE_PUBLIC
// resolves to the right base in both. Whitelisted so the renderer can't read arbitrary files.
const MODEL_FILES = new Set(['demucs.js', 'demucs.wasm', 'demucs.data'])

function modelDir(): string {
  return path.join(process.env.VITE_PUBLIC!, 'stem-model')
}

export function getModelFile(name: string): Uint8Array {
  if (!MODEL_FILES.has(name)) throw new Error(`unknown stem model file: ${name}`)
  const full = path.join(modelDir(), name)
  if (!fs.existsSync(full)) {
    throw new Error(`stem model not found (run "pnpm fetch:stem-model"): ${name}`)
  }
  return fs.readFileSync(full)
}

function stemsDir(sourceHash: string): string {
  return path.join(app.getPath('userData'), 'stems', sourceHash)
}

function stemPath(sourceHash: string, name: StemName): string {
  return path.join(stemsDir(sourceHash), `${name}.wav`)
}

// Return the cached stem set only if every stem WAV is present; otherwise null (re-separate).
export function getCachedStems(sourceHash: string): StemFile[] | null {
  const files = STEM_NAMES.map((name) => ({ name, filePath: stemPath(sourceHash, name) }))
  return files.every((f) => fs.existsSync(f.filePath)) ? files : null
}

// Minimal 32-bit float WAV (format tag 3, interleaved stereo). Written as a temp file that the
// render funnel then normalizes to LIBRARY_FORMAT, so we don't add a second encode path.
function writeFloatWav(filePath: string, left: Float32Array, right: Float32Array, sampleRate: number): void {
  const frames = Math.min(left.length, right.length)
  const channels = 2
  const bytesPerSample = 4
  const blockAlign = channels * bytesPerSample
  const dataBytes = frames * blockAlign
  const buffer = Buffer.alloc(44 + dataBytes)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(3, 20) // IEEE float
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * blockAlign, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bytesPerSample * 8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)

  let offset = 44
  for (let i = 0; i < frames; i++) {
    buffer.writeFloatLE(left[i], offset)
    buffer.writeFloatLE(right[i], offset + 4)
    offset += 8
  }
  fs.writeFileSync(filePath, buffer)
}

// Write each separated stem to userData/stems/<hash>/<name>.wav, normalized through the render funnel.
export async function persistStems(sourceHash: string, stems: StemPcm[]): Promise<StemFile[]> {
  const dir = stemsDir(sourceHash)
  fs.mkdirSync(dir, { recursive: true })

  const result: StemFile[] = []
  for (const stem of stems) {
    const finalPath = stemPath(sourceHash, stem.name)
    const tempPath = path.join(dir, `${stem.name}.tmp.wav`)
    writeFloatWav(tempPath, stem.left, stem.right, stem.sampleRate)
    await renderClip(tempPath, { start: null, end: null }, finalPath, LIBRARY_FORMAT)
    fs.rmSync(tempPath, { force: true })
    result.push({ name: stem.name, filePath: finalPath })
  }
  return result
}
