export type Sample = {
  id: string
  name: string
  filePath: string
  duration: number | null
  bpm: number | null
  musicalKey: string | null
  tags: string[]
  source: 'local' | 'freesound'
  freesoundId: string | null
  waveformData: number[] | null
  projectId: string | null
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
  pitchShiftSemitones: number | null
  timeStretchRatio: number | null
}

export type Project = {
  id: string
  name: string
  sourcePath: string | null
  sourceName: string | null
  source: 'local' | 'freesound'
  regions: ProjectRegion[]
  createdAt: number
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

export type ExportRegionsParams = {
  regions: ProjectRegion[]
  sourceFilePath: string
  outputDir: string
  profileId: string
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
