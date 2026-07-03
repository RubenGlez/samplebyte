export type Sample = {
  id: string
  name: string
  filePath: string
  duration: number | null
  bpm: number | null
  musicalKey: string | null
  tags: string[]
  source: 'local' | 'freesound' | 'chop'
  freesoundId: string | null
  // Attribution for Creative Commons audio from Freesound, carried so exported packs can credit
  // sources (most CC licenses require it). Null for local/own audio. See F24.
  license: string | null
  author: string | null
  waveformData: number[] | null
  projectId: string | null
  // Set when this sample was materialized from a project chop (trimmed to a real file).
  // Doubles as the idempotency key for the one-time chop materialization migration.
  sourceChopId: string | null
  // True only for files the app rendered/copied into its own storage (userData/samples). Deleting
  // such a row deletes its file; import-in-place originals and shared cache files (stems) are
  // owned=false and are never unlinked. See F1/T1 in the adversarial audit.
  owned: boolean
  createdAt: number
}

export type Pack = {
  id: string
  name: string
  hardwareProfile: string
  createdAt: number
}

export type PackSlot = {
  packId: string
  slotNumber: number
  sourceType: 'project-chop' | 'library-sample'
  sourcePath: string
  projectId: string | null
  projectChopId: string | null
  sampleId: string | null
  start: number | null
  end: number | null
  displayName: string
  sourceChopUpdatedAt: number | null
  // Owned trimmed WAV captured at assignment, so the pad exports independently of its source.
  audioPath: string | null
}

export type Project = {
  id: string
  name: string
  sourcePath: string | null
  sourceName: string | null
  source: 'local' | 'freesound'
  // Freesound attribution for the source, propagated to materialized chop samples so packs can be
  // credited on export (F24).
  freesoundId: string | null
  license: string | null
  author: string | null
  regions: ProjectRegion[]
  createdAt: number
}

// Freesound attribution captured when a preview is opened, carried through project save into
// materialized samples.
export type FreesoundAttribution = {
  freesoundId: string
  license: string
  author: string
}

export type ProjectRegion = {
  id?: string
  start: number
  end: number
  name: string
}

export type ProjectChop = {
  id: string
  projectId: string
  name: string
  start: number
  end: number
  createdAt: number
  updatedAt: number
}

export type PackSourceItem = {
  id: string
  sourceType: 'project-chop' | 'library-sample'
  displayName: string
  sourcePath: string
  projectId: string | null
  projectName: string | null
  projectChopId: string | null
  sampleId: string | null
  start: number | null
  end: number | null
  duration: number | null
  bpm: number | null
  musicalKey: string | null
  tags: string[]
  sourceChopUpdatedAt: number | null
}

export type TrimSourceParams = {
  sourceFilePath: string
  start: number
  end: number
}

export type TrimSourceResult = {
  filePath: string
  duration: number
}

export type FreesoundResult = {
  id: number
  name: string
  username: string
  duration: number
  previews: { 'preview-hq-mp3': string; 'preview-lq-mp3': string }
  tags: string[]
  license: string
}

export type FreesoundPage = {
  count: number
  next: string | null
  previous: string | null
  results: FreesoundResult[]
}

// Stem separation (Chop tab "Stems" tool). The vendored demucs 4-source model.
export type StemName = 'drums' | 'bass' | 'other' | 'vocals'

export const STEM_NAMES: StemName[] = ['drums', 'bass', 'other', 'vocals']

// Raw separated PCM produced by the worker, handed to main for persistence.
export type StemPcm = {
  name: StemName
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

// A persisted stem on disk (one normalized WAV under userData/stems/<hash>/).
export type StemFile = {
  name: StemName
  filePath: string
}
