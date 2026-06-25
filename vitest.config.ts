import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// The main-process code imports electron for `app` (userData paths, ffmpeg binary resolution). Under
// vitest there is no electron runtime, so alias it to a stub that points userData at a temp dir.
export default defineConfig({
  resolve: {
    alias: {
      electron: fileURLToPath(new URL('./test/electron-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['electron/**/*.test.ts'],
    // ffmpeg renders against a real fixture, so allow more than the 5s default.
    testTimeout: 30000,
  },
})
