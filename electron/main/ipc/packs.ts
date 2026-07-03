import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { handle } from './handle'
import * as packsDb from '../db/queries/packs'
import { addSample, getSample, getSampleBySourceChopId as samplesBySourceChopId } from '../db/queries/samples'
import { logMain } from '../services/log'
import type { PackSlot } from '../../types'
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

// Write a credits.txt next to the exported audio listing attribution for any Creative Commons
// sources in the pack, so the user can comply with Freesound licenses when sharing the pack (F24).
// Resolves each pad to its sample (library-sample pads by id, chop pads by source chop id) and
// dedupes by Freesound id. No-op when nothing needs crediting.
function writeCreditsFile(outputDir: string, packName: string, slots: PackSlot[]): void {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const slot of slots) {
    const sample = slot.sampleId
      ? getSample(slot.sampleId)
      : slot.projectChopId
        ? samplesBySourceChopId(slot.projectChopId)
        : null
    if (!sample || (!sample.license && !sample.author)) continue
    const key = sample.freesoundId ?? sample.id
    if (seen.has(key)) continue
    seen.add(key)
    const parts = [sample.name]
    if (sample.author) parts.push(`by ${sample.author}`)
    if (sample.license) parts.push(`(${sample.license})`)
    if (sample.freesoundId) parts.push(`— https://freesound.org/s/${sample.freesoundId}/`)
    lines.push(`- ${parts.join(' ')}`)
  }
  if (lines.length === 0) return

  const body =
    `Credits for "${packName}"\n\n` +
    `This pack contains Creative Commons audio from Freesound. Most CC licenses require attribution — please keep these credits with the pack:\n\n` +
    `${lines.join('\n')}\n`
  try {
    fs.writeFileSync(path.join(outputDir, 'credits.txt'), body)
  } catch (error) {
    logMain('writeCreditsFile:failed', error)
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

    const result = await exportClips(profile, clips, outputDir)
    writeCreditsFile(outputDir, pack.name, pack.slots)
    return result
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
      owned: true,
    })
    packsDb.relinkSlotToSample(packId, slotNumber, sample)
    return sample
  })
}
