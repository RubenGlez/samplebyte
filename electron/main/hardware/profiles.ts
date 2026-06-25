export type HardwareProfile = {
  id: string
  name: string
  padCount: number
  format: {
    container: 'wav' | 'aiff'
    sampleRate: 44100 | 48000 | 96000
    bitDepth: 16 | 24 | 32
    sampleFmt: string
  }
  fileName: (slot: number, sampleName: string) => string
}

export const profiles: HardwareProfile[] = [
  {
    id: 'sp404-mkii',
    name: 'Roland SP-404 MkII',
    padCount: 16,
    format: { container: 'wav', sampleRate: 48000, bitDepth: 16, sampleFmt: 's16' },
    fileName: (slot, name) => `${String(slot + 1).padStart(3, '0')}_${sanitize(name)}.wav`,
  },
  {
    id: 'mpc-generic',
    name: 'Akai MPC One',
    padCount: 16,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 24, sampleFmt: 's24' },
    fileName: (_, name) => `${sanitize(name)}.wav`,
  },
  {
    id: 'maschine-mk3',
    name: 'Maschine MK3',
    padCount: 16,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 16, sampleFmt: 's16' },
    fileName: (slot, name) => `${String(slot + 1).padStart(2, '0')}_${sanitize(name)}.wav`,
  },
  {
    id: 'generic',
    name: 'Generic WAV',
    padCount: 128,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 24, sampleFmt: 's24' },
    fileName: (_, name) => `${sanitize(name)}.wav`,
  },
]

export function getProfile(id: string): HardwareProfile {
  const profile = profiles.find((p) => p.id === id)
  if (!profile) throw new Error(`Unknown hardware profile: ${id}`)
  return profile
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}
