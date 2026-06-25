import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { handle } from './handle'
import * as packsDb from '../db/queries/packs'
import { addSample } from '../db/queries/samples'
import { extractWaveformData } from '../audio/waveform'
import { getProfile, profiles } from '../hardware/profiles'
import type { Pack, PackSourceItem } from '../../types'
import { renderClip, LIBRARY_FORMAT } from '../services/render'
import { exportClips, type ExportClip } from '../services/export'

// Trim (or, for a whole sample, copy) the slot's source audio into a pad-owned WAV so the pack
// exports without depending on the original chop/sample/file. Returns the owned file path.
async function materializeSlotAudio(source: PackSourceItem): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'pack-slots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const outputPath = path.join(dir, `${crypto.randomUUID()}.wav`)
  await renderClip(source.sourcePath, { start: source.start, end: source.end }, outputPath, LIBRARY_FORMAT)
  return outputPath
}

function unlinkQuietly(filePath: string | null): void {
  if (filePath) {
    try { fs.unlinkSync(filePath) } catch { /* already gone */ }
  }
}

export function registerPacksHandlers(): void {
  handle('packs:getAll', () => {
    return packsDb.getAllPacks()
  })

  handle('packs:getProfiles', () => {
    return profiles.map(({ id, name, padCount }) => ({ id, name, padCount }))
  })

  handle('packs:create', (_, data: Pick<Pack, 'name' | 'hardwareProfile'>) => {
    return packsDb.createPack(data)
  })

  handle('packs:getSlots', (_, packId: string) => {
    const pack = packsDb.getPackWithSlots(packId)
    return pack ? pack.slots : []
  })

  handle('packs:upsertSlot', async (_, packId: string, slotNumber: number, source: PackSourceItem) => {
    const previous = packsDb.getSlotAudioPath(packId, slotNumber)
    // Own the audio at assignment. If the source is unreadable, fall back to a null owned path —
    // export then trims from source_path as before, so assignment never hard-fails.
    let audioPath: string | null
    try { audioPath = await materializeSlotAudio(source) } catch { audioPath = null }
    packsDb.upsertSlot(packId, slotNumber, source, audioPath)
    if (previous !== audioPath) unlinkQuietly(previous)
  })

  handle('packs:removeSlot', (_, packId: string, slotNumber: number) => {
    const audioPath = packsDb.getSlotAudioPath(packId, slotNumber)
    packsDb.removeSlot(packId, slotNumber)
    unlinkQuietly(audioPath)
  })

  handle('packs:rename', (_, id: string, name: string) => {
    packsDb.renamePack(id, name)
  })

  handle('packs:delete', (_, id: string) => {
    const audioPaths = packsDb.getPackSlotAudioPaths(id)
    packsDb.deletePack(id)
    for (const audioPath of audioPaths) unlinkQuietly(audioPath)
  })

  handle('packs:export', async (_, packId: string, outputDir: string) => {
    const pack = packsDb.getPackWithSlots(packId)
    if (!pack) throw new Error(`Pack not found: ${packId}`)

    const profile = getProfile(pack.hardwareProfile)

    const clips: ExportClip[] = pack.slots.map((slot) => ({
      // Owned audio is pre-trimmed, so render it directly (no trim window). Legacy slots (no owned
      // audio) still trim from the source path at export.
      sourcePath: slot.audioPath ?? slot.sourcePath,
      slotNumber: slot.slotNumber,
      name: slot.displayName,
      start: slot.audioPath ? null : slot.start,
      end: slot.audioPath ? null : slot.end,
    }))

    return exportClips(profile, clips, outputDir)
  })

  // Recover an orphaned chop pad (its origin chop was deleted, so its library sample is gone) by
  // copying the pad's owned WAV back into the library as a new local sample and relinking the pad to
  // it. The owned audio is already LIBRARY_FORMAT, so it's copied as-is rather than re-rendered.
  handle('packs:regenerateSlotToLibrary', (_, packId: string, slotNumber: number) => {
    const slot = packsDb.getSlot(packId, slotNumber)
    if (!slot?.audioPath) throw new Error('Slot has no owned audio to regenerate from')

    const samplesDir = path.join(app.getPath('userData'), 'samples')
    if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true })
    const filePath = path.join(samplesDir, `${crypto.randomUUID()}.wav`)
    fs.copyFileSync(slot.audioPath, filePath)

    const sample = addSample({
      name: slot.displayName,
      filePath,
      source: 'local',
      waveformData: extractWaveformData(filePath),
    })
    packsDb.relinkSlotToSample(packId, slotNumber, sample)
    return sample
  })
}
