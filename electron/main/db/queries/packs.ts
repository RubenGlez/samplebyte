import { getDb } from '../index'
import type { Pack, PackSlot, PackSourceItem } from '../../../types'

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
    pitchShiftSemitones: row.pitch_shift_semitones as number | null,
    timeStretchRatio: row.time_stretch_ratio as number | null,
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

export function createPack(data: Pick<Pack, 'name' | 'hardwareProfile'>): Pack {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  db.prepare('INSERT INTO packs (id, name, hardware_profile, created_at) VALUES (?, ?, ?, ?)').run(id, data.name, data.hardwareProfile, createdAt)

  return { id, name: data.name, hardwareProfile: data.hardwareProfile, createdAt }
}

export function upsertSlot(packId: string, slotNumber: number, source: PackSourceItem): void {
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
        pitch_shift_semitones,
        time_stretch_ratio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      null,
      null
    )
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
