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
  sampleId: string
}

export type Project = {
  id: string
  name: string
  sourcePath: string | null
  regions: ProjectRegion[]
  createdAt: number
}

export type ProjectRegion = {
  start: number
  end: number
  name: string
}

export type ExportRegionsParams = {
  regions: ProjectRegion[]
  sourceFilePath: string
  outputDir: string
  profileId: string
}
