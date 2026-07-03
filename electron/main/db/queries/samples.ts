import { getDb } from '../index'
import type { Sample } from '../../../types'

type SampleFilters = {
  bpm?: number
  key?: string
  tags?: string[]
  source?: string
  projectId?: string
}

type NewSample = Pick<Sample, 'name' | 'filePath'> & Partial<Pick<Sample, 'duration' | 'bpm' | 'musicalKey' | 'tags' | 'source' | 'freesoundId' | 'license' | 'author' | 'waveformData' | 'projectId' | 'sourceChopId' | 'owned'>>

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
    license: row.license as string | null,
    author: row.author as string | null,
    waveformData: row.waveform_data ? JSON.parse(row.waveform_data as string) : null,
    projectId: row.project_id as string | null,
    sourceChopId: row.source_chop_id as string | null,
    owned: (row.owned as number) === 1,
    createdAt: row.created_at as number,
  }
}

export function getSample(id: string): Sample | null {
  const row = getDb().prepare('SELECT * FROM samples WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserialize(row) : null
}

// The materialized sample for a project chop, if any. Used to resolve attribution for chop-based
// pack pads (which reference a chop, not a sample row) when writing export credits (F24).
export function getSampleBySourceChopId(chopId: string): Sample | null {
  const row = getDb().prepare('SELECT * FROM samples WHERE source_chop_id = ? LIMIT 1').get(chopId) as Record<string, unknown> | undefined
  return row ? deserialize(row) : null
}

export function getAllSamples(filters?: SampleFilters): Sample[] {
  const db = getDb()

  const conditions: string[] = []
  const values: unknown[] = []

  if (filters?.bpm !== undefined) {
    conditions.push('ABS(COALESCE(bpm, 0) - ?) <= 5')
    values.push(filters.bpm)
  }
  if (filters?.key) {
    conditions.push('musical_key = ?')
    values.push(filters.key)
  }
  if (filters?.source) {
    conditions.push('source = ?')
    values.push(filters.source)
  }
  if (filters?.projectId !== undefined) {
    conditions.push('project_id = ?')
    values.push(filters.projectId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM samples ${where} ORDER BY created_at DESC`).all(...values) as Record<string, unknown>[]
  const result = rows.map(deserialize)

  // Tags are JSON arrays in the column; filter in-memory to avoid json_each complexity
  if (filters?.tags?.length) {
    return result.filter((s) => filters.tags!.some((t) => s.tags.includes(t)))
  }
  return result
}

export function addSample(data: NewSample): Sample {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  db.prepare(`
    INSERT INTO samples (id, name, file_path, duration, bpm, musical_key, tags, source, freesound_id, license, author, waveform_data, project_id, source_chop_id, owned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.license ?? null,
    data.author ?? null,
    data.waveformData ? JSON.stringify(data.waveformData) : null,
    data.projectId ?? null,
    data.sourceChopId ?? null,
    data.owned ? 1 : 0,
    createdAt
  )

  return getSample(id)!
}

// Bulk-register imported-in-place local files in one transaction (fast even for large folders) and
// skip any whose path already exists (UNIQUE file_path). owned=0: these are the user's own files, so
// deleting the row must never unlink them (F1). Returns how many rows were actually inserted (F16).
export function importLocalFiles(files: { name: string; filePath: string }[]): number {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO samples (id, name, file_path, tags, source, owned, created_at)
    VALUES (?, ?, ?, '[]', 'local', 0, ?)
  `)
  const tx = db.transaction((rows: { name: string; filePath: string }[]) => {
    let inserted = 0
    const now = Date.now()
    for (const row of rows) {
      const result = insert.run(crypto.randomUUID(), row.name, row.filePath, now)
      inserted += result.changes
    }
    return inserted
  })
  return tx(files)
}

// Chop ids that have already been materialized into a sample. Backs the idempotency
// guard for the one-time chop materialization pass.
export function getMaterializedChopIds(): Set<string> {
  const rows = getDb().prepare('SELECT source_chop_id FROM samples WHERE source_chop_id IS NOT NULL').all() as { source_chop_id: string }[]
  return new Set(rows.map((r) => r.source_chop_id))
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

  if (data.name !== undefined) {
    db.prepare('UPDATE pack_slots SET display_name = ? WHERE sample_id = ?').run(data.name, id)
  }
}

// Delete a library sample row and return the file path to unlink — but only when the app owns that
// file (rendered/copied into userData/samples). Import-in-place originals and shared stem-cache
// files return null so the caller never destroys them (F1/T1). Pack slots referencing the sample are
// left intact: packs are independent snapshots that own their own audio and fall into the recovery
// flow when their origin sample disappears (F22, matches deleteChopSampleRow).
export function deleteSample(id: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT file_path, owned FROM samples WHERE id = ?').get(id) as { file_path: string; owned: number } | undefined
  db.prepare('DELETE FROM samples WHERE id = ?').run(id)
  return row && row.owned === 1 ? row.file_path : null
}

export function getSamplePackSlotRefCount(sampleId: string): number {
  return ((getDb().prepare('SELECT COUNT(*) as count FROM pack_slots WHERE sample_id = ?').get(sampleId)) as { count: number }).count
}

// Re-point a materialized chop sample at freshly trimmed audio after its source chop changed.
// Bumps created_at so the next project sync treats it as current. Does not touch pack_slots —
// packs are independent snapshots and keep their own display name and audio.
export function refreshChopSample(
  id: string,
  data: { name: string; filePath: string; duration: number; waveformData: number[] }
): void {
  getDb()
    .prepare('UPDATE samples SET name = ?, file_path = ?, duration = ?, waveform_data = ?, created_at = ? WHERE id = ?')
    .run(data.name, data.filePath, data.duration, JSON.stringify(data.waveformData), Date.now(), id)
}

// Delete only the sample row, returning its file path. Leaves any pack_slots referencing it
// intact: when a chop is removed from its project the library drops it, but packs are independent
// snapshots that keep working from their stored source path + bounds.
export function deleteChopSampleRow(id: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT file_path FROM samples WHERE id = ?').get(id) as { file_path: string } | undefined
  db.prepare('DELETE FROM samples WHERE id = ?').run(id)
  return row?.file_path ?? null
}
