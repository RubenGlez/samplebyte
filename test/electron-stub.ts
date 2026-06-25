import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// Minimal stand-in for electron's `app` under vitest: userData lives in a throwaway temp dir so
// rendered files and any db live in isolation, and isPackaged=false routes ffmpeg resolution through
// the dev path (require.resolve of the installed @ffmpeg-installer binary).
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'samplebyte-test-'))

export const app = {
  getPath: (name: string): string => (name === 'userData' ? userData : path.join(userData, name)),
  getAppPath: (): string => process.cwd(),
  isPackaged: false,
}

export default { app }
