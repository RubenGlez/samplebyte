import { getDb } from '../index'
import type { Pack, PackSlot, PackSourceItem, Sample } from '../../../types'

type PackWithSlots = Pack & { slots: PackSlot[] }

function deserializePack(row: Record<string, unknown>): Pack {
  return {
    id: row.id as string,
    name: row.name as string,
    hardwareProfile: row.hardware_profile as string,
    createdAt: row.created_at as number,
  }
}

function deserializeSlot(row: Record<string, unknown>): PackSlot {
  return {
    packId: row.pack_id as string,
    slotNumber: row.slot_number as number,
    sourceType: row.source_type as PackSlot['sourceType'],
    sourcePath: row.source_path as string,
    projectId: row.project_id as string | null,
    projectChopId: row.project_chop_id as string | null,
    sampleId: row.sample_id as string | null,
    start: row.start as number | null,
    end: row.end as number | null,
    displayName: row.display_name as string,
    sourceChopUpdatedAt: row.source_chop_updated_at as number | null,
    audioPath: row.audio_path as string | null,
  }
}

export function getAllPacks(): Pack[] {
  const db = getDb()
  return (db.prepare('SELECT * FROM packs ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(deserializePack)
}

export function getPackWithSlots(id: string): PackWithSlots | null {
  const db = getDb()
  const pack = db.prepare('SELECT * FROM packs WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!pack) return null

  const slots = (db.prepare('SELECT * FROM pack_slots WHERE pack_id = ? ORDER BY slot_number').all(id) as Record<string, unknown>[]).map(deserializeSlot)

  return { ...deserializePack(pack), slots }
}

export function getSlot(packId: string, slotNumber: number): PackSlot | null {
  const row = getDb()
    .prepare('SELECT * FROM pack_slots WHERE pack_id = ? AND slot_number = ?')
    .get(packId, slotNumber) as Record<string, unknown> | undefined
  return row ? deserializeSlot(row) : null
}

// Re-point a pad at a freshly created library sample after its origin chop was deleted, keeping the
// pad's owned audio (audio_path) so export is unaffected. Clears the chop back-reference and drift
// marker — the pad now tracks a plain local sample with no upstream chop.
export function relinkSlotToSample(packId: string, slotNumber: number, sample: Sample): void {
  getDb()
    .prepare(`
      UPDATE pack_slots
      SET sample_id = ?, source_type = 'library-sample', source_path = ?,
          project_chop_id = NULL, source_chop_updated_at = NULL
      WHERE pack_id = ? AND slot_number = ?
    `)
    .run(sample.id, sample.filePath, packId, slotNumber)
}

export function createPack(data: Pick<Pack, 'name' | 'hardwareProfile'>): Pack {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  db.prepare('INSERT INTO packs (id, name, hardware_profile, created_at) VALUES (?, ?, ?, ?)').run(id, data.name, data.hardwareProfile, createdAt)

  return { id, name: data.name, hardwareProfile: data.hardwareProfile, createdAt }
}

export function upsertSlot(packId: string, slotNumber: number, source: PackSourceItem, audioPath: string | null): void {
  getDb()
    .prepare(`
      INSERT OR REPLACE INTO pack_slots (
        pack_id,
        slot_number,
        source_type,
        source_path,
        project_id,
        project_chop_id,
        sample_id,
        start,
        end,
        display_name,
        source_chop_updated_at,
        audio_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      packId,
      slotNumber,
      source.sourceType,
      source.sourcePath,
      source.projectId,
      source.projectChopId,
      source.sampleId,
      source.start,
      source.end,
      source.displayName,
      source.sourceChopUpdatedAt,
      audioPath
    )
}

// Owned audio path currently stored for a slot (so the caller can delete the orphaned file when a
// slot is overwritten or removed).
export function getSlotAudioPath(packId: string, slotNumber: number): string | null {
  const row = getDb()
    .prepare('SELECT audio_path FROM pack_slots WHERE pack_id = ? AND slot_number = ?')
    .get(packId, slotNumber) as { audio_path: string | null } | undefined
  return row?.audio_path ?? null
}

export function getPackSlotAudioPaths(packId: string): string[] {
  return (getDb()
    .prepare('SELECT audio_path FROM pack_slots WHERE pack_id = ? AND audio_path IS NOT NULL')
    .all(packId) as { audio_path: string }[]).map((r) => r.audio_path)
}

export function removeSlot(packId: string, slotNumber: number): void {
  getDb().prepare('DELETE FROM pack_slots WHERE pack_id = ? AND slot_number = ?').run(packId, slotNumber)
}

export function renamePack(id: string, name: string): void {
  getDb().prepare('UPDATE packs SET name = ? WHERE id = ?').run(name, id)
}

export function deletePack(id: string): void {
  getDb().prepare('DELETE FROM packs WHERE id = ?').run(id)
}
