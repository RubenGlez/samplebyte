import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ffmpeg from 'fluent-ffmpeg'

const require = createRequire(import.meta.url)

function getFfmpegBinaryPath(): string {
  const platform = process.platform
  const arch = process.arch
  const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const platformDir = `@ffmpeg-installer/${platform}-${arch}`

  if (app.isPackaged) {
    // In production, the binary is unpacked in resources/app.asar.unpacked/node_modules
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@ffmpeg-installer',
      `${platform}-${arch}`,
      binaryName
    )
  } else {
    // In development, resolve via package.json to support pnpm symlinks
    try {
      const packageJsonPath = require.resolve(path.join(platformDir, 'package.json'))
      return path.join(path.dirname(packageJsonPath), binaryName)
    } catch {
      // Fallback if require.resolve fails
      return path.join(
        app.getAppPath(),
        'node_modules',
        '@ffmpeg-installer',
        `${platform}-${arch}`,
        binaryName
      )
    }
  }
}

export function configureFfmpeg(): void {
  const ffmpegPath = getFfmpegBinaryPath()
  ffmpeg.setFfmpegPath(ffmpegPath)
}

// Whether the bundled ffmpeg binary actually exists for this platform/arch. @ffmpeg-installer only
// pins darwin/win32 in optionalDependencies, so an unsupported arch (e.g. Linux) resolves nothing
// and every render would fail deep in a per-clip rejection. Probing once at startup lets us tell the
// user plainly instead of surfacing it as mysterious per-operation failures (F17).
export function isFfmpegAvailable(): boolean {
  try {
    return fs.existsSync(getFfmpegBinaryPath())
  } catch {
    return false
  }
}

export { ffmpeg }
