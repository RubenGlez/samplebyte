import { getDb } from '../index'
import type { Sample } from '../../../types'

type SampleFilters = {
  bpm?: number
  key?: string
  tags?: string[]
  source?: string
  projectId?: string
}

type NewSample = Pick<Sample, 'name' | 'filePath'> & Partial<Pick<Sample, 'duration' | 'bpm' | 'musicalKey' | 'tags' | 'source' | 'freesoundId' | 'waveformData' | 'projectId'>>

function deserialize(row: Record<string, unknown>): Sample {
  return {
    id: row.id as string,
    name: row.name as string,
    filePath: row.file_path as string,
    duration: row.duration as number | null,
    bpm: row.bpm as number | null,
    musicalKey: row.musical_key as string | null,
    tags: JSON.parse((row.tags as string) || '[]'),
    source: (row.source as Sample['source']) || 'local',
    freesoundId: row.freesound_id as string | null,
    waveformData: row.waveform_data ? JSON.parse(row.waveform_data as string) : null,
    projectId: row.project_id as string | null,
    createdAt: row.created_at as number,
  }
}

export function getAllSamples(filters?: SampleFilters): Sample[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM samples ORDER BY created_at DESC').all() as Record<string, unknown>[]

  return rows.map(deserialize).filter((sample) => {
    if (!filters) return true
    if (filters.bpm !== undefined && Math.abs((sample.bpm ?? 0) - filters.bpm) > 5) return false
    if (filters.key && sample.musicalKey !== filters.key) return false
    if (filters.tags?.length && !filters.tags.some((t) => sample.tags.includes(t))) return false
    if (filters.source && sample.source !== filters.source) return false
    if (filters.projectId !== undefined && sample.projectId !== filters.projectId) return false
    return true
  })
}

export function addSample(data: NewSample): Sample {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  db.prepare(`
    INSERT INTO samples (id, name, file_path, duration, bpm, musical_key, tags, source, freesound_id, waveform_data, project_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.filePath,
    data.duration ?? null,
    data.bpm ?? null,
    data.musicalKey ?? null,
    JSON.stringify(data.tags ?? []),
    data.source ?? 'local',
    data.freesoundId ?? null,
    data.waveformData ? JSON.stringify(data.waveformData) : null,
    data.projectId ?? null,
    createdAt
  )

  return getAllSamples().find((s) => s.id === id)!
}

export function updateSample(id: string, data: Partial<Pick<Sample, 'name' | 'bpm' | 'musicalKey' | 'tags' | 'waveformData'>>): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.bpm !== undefined) { fields.push('bpm = ?'); values.push(data.bpm) }
  if (data.musicalKey !== undefined) { fields.push('musical_key = ?'); values.push(data.musicalKey) }
  if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
  if (data.waveformData !== undefined) { fields.push('waveform_data = ?'); values.push(JSON.stringify(data.waveformData)) }

  if (fields.length === 0) return
  values.push(id)

  db.prepare(`UPDATE samples SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteSample(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM pack_slots WHERE sample_id = ?').run(id)
  db.prepare('DELETE FROM samples WHERE id = ?').run(id)
}
