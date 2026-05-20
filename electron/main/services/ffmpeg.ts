import { app } from 'electron'
import path from 'node:path'
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
    } catch (e) {
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

export { ffmpeg }
