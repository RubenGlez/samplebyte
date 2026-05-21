import { ipcMain } from 'electron'
import * as packsDb from '../db/queries/packs'
import * as samplesDb from '../db/queries/samples'
import { getProfile, applyProfileFormat, profiles } from '../hardware/profiles'
import type { Pack } from '../../types'
import path from 'node:path'
import fs from 'node:fs'
import { configureFfmpeg, ffmpeg } from '../services/ffmpeg'

configureFfmpeg()

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

  ipcMain.handle('packs:upsertSlot', (_, packId: string, slotNumber: number, sampleId: string) => {
    packsDb.upsertSlot(packId, slotNumber, sampleId)
  })

  ipcMain.handle('packs:removeSlot', (_, packId: string, slotNumber: number) => {
    packsDb.removeSlot(packId, slotNumber)
  })

  ipcMain.handle('packs:rename', (_, id: string, name: string) => {
    packsDb.renamePack(id, name)
  })

  ipcMain.handle('packs:delete', (_, id: string) => {
    packsDb.deletePack(id)
  })

  ipcMain.handle('packs:export', async (_, packId: string, outputDir: string) => {
    const pack = packsDb.getPackWithSlots(packId)
    if (!pack) throw new Error(`Pack not found: ${packId}`)

    const profile = getProfile(pack.hardwareProfile)
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const allSamples = samplesDb.getAllSamples()

    await Promise.all(
      pack.slots.map((slot) =>
        new Promise<void>((resolve, reject) => {
          const sample = allSamples.find((s) => s.id === slot.sampleId)
          if (!sample) { resolve(); return }

          const outputFile = path.join(outputDir, profile.fileName(slot.slotNumber, sample.name))

          applyProfileFormat(profile, ffmpeg(sample.filePath))
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
