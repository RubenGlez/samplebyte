// Downloads the vendored, MIT-licensed prebuilt demucs WASM (4-source model) used by the
// Stems tool into public/stem-model/. These are large binaries (~85MB) so they are gitignored
// and fetched on demand. Source: https://github.com/uzstudio/free-music-demixer (MIT).
//
// Run: node scripts/fetch-stem-model.mjs   (or: pnpm fetch:stem-model)
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'stem-model')
const BASE = 'https://raw.githubusercontent.com/uzstudio/free-music-demixer/main/docs'

// name -> approximate expected size (bytes) for a sanity check
const FILES = {
  'demucs.js': 81712,
  'demucs.wasm': 548222,
  'demucs.data': 83994361,
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const [name, expected] of Object.entries(FILES)) {
    const dest = join(OUT_DIR, name)
    if (await exists(dest)) {
      const { size } = await stat(dest)
      if (Math.abs(size - expected) < expected * 0.2) {
        console.log(`✓ ${name} already present (${size} bytes)`)
        continue
      }
    }
    process.stdout.write(`↓ ${name} … `)
    const res = await fetch(`${BASE}/${name}`)
    if (!res.ok) throw new Error(`failed to download ${name}: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(dest, buf)
    console.log(`${buf.length} bytes`)
  }
  console.log(`\nStem model ready in ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('fetch-stem-model failed:', err)
  process.exit(1)
})
