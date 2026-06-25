import { ipcMain, app } from 'electron'
import * as packsDb from '../db/queries/packs'
import { getProfile, applyProfileFormat, profiles } from '../hardware/profiles'
import type { Pack, PackSourceItem } from '../../types'
import path from 'node:path'
import fs from 'node:fs'
import { configureFfmpeg, ffmpeg } from '../services/ffmpeg'

configureFfmpeg()

// Trim (or, for a whole sample, copy) the slot's source audio into a pad-owned WAV so the pack
// exports without depending on the original chop/sample/file. Returns the owned file path.
function materializeSlotAudio(source: PackSourceItem): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'pack-slots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const outputPath = path.join(dir, `${crypto.randomUUID()}.wav`)
  return new Promise((resolve, reject) => {
    const input = ffmpeg(source.sourcePath)
    if (source.start !== null && source.end !== null) {
      input.setStartTime(source.start).setDuration(source.end - source.start)
    }
    input
      .toFormat('wav')
      .audioFrequency(44100)
      .audioChannels(2)
      .outputOptions(['-sample_fmt s16'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

function unlinkQuietly(filePath: string | null): void {
  if (filePath) {
    try { fs.unlinkSync(filePath) } catch { /* already gone */ }
  }
}

export function registerPacksHandlers(): void {
  ipcMain.handle('packs:getAll', () => {
    return packsDb.getAllPacks()
  })

  ipcMain.handle('packs:getProfiles', () => {
    return profiles.map(({ id, name, padCount }) => ({ id, name, padCount }))
  })

  ipcMain.handle('packs:create', (_, data: Pick<Pack, 'name' | 'hardwareProfile'>) => {
    return packsDb.createPack(data)
  })

  ipcMain.handle('packs:getSlots', (_, packId: string) => {
    const pack = packsDb.getPackWithSlots(packId)
    return pack ? pack.slots : []
  })

  ipcMain.handle('packs:upsertSlot', async (_, packId: string, slotNumber: number, source: PackSourceItem) => {
    const previous = packsDb.getSlotAudioPath(packId, slotNumber)
    // Own the audio at assignment. If the source is unreadable, fall back to a null owned path —
    // export then trims from source_path as before, so assignment never hard-fails.
    let audioPath: string | null
    try { audioPath = await materializeSlotAudio(source) } catch { audioPath = null }
    packsDb.upsertSlot(packId, slotNumber, source, audioPath)
    if (previous !== audioPath) unlinkQuietly(previous)
  })

  ipcMain.handle('packs:removeSlot', (_, packId: string, slotNumber: number) => {
    const audioPath = packsDb.getSlotAudioPath(packId, slotNumber)
    packsDb.removeSlot(packId, slotNumber)
    unlinkQuietly(audioPath)
  })

  ipcMain.handle('packs:rename', (_, id: string, name: string) => {
    packsDb.renamePack(id, name)
  })

  ipcMain.handle('packs:delete', (_, id: string) => {
    const audioPaths = packsDb.getPackSlotAudioPaths(id)
    packsDb.deletePack(id)
    for (const audioPath of audioPaths) unlinkQuietly(audioPath)
  })

  ipcMain.handle('packs:export', async (_, packId: string, outputDir: string) => {
    const pack = packsDb.getPackWithSlots(packId)
    if (!pack) throw new Error(`Pack not found: ${packId}`)

    const profile = getProfile(pack.hardwareProfile)
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    await Promise.all(
      pack.slots.map((slot) =>
        new Promise<void>((resolve, reject) => {
          const outputFile = path.join(outputDir, profile.fileName(slot.slotNumber, slot.displayName))
          // Owned audio is pre-trimmed, so render it directly. Legacy slots (no owned audio) still
          // trim from the source path at export.
          const input = ffmpeg(slot.audioPath ?? slot.sourcePath)
          if (!slot.audioPath && slot.start !== null && slot.end !== null) {
            input.setStartTime(slot.start).setDuration(slot.end - slot.start)
          }

          applyProfileFormat(profile, input)
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', reject)
            .run()
        })
      )
    )

    return { filesWritten: pack.slots.length }
  })
}
