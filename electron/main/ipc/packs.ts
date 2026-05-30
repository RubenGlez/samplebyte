import { ipcMain } from 'electron'
import * as packsDb from '../db/queries/packs'
import { getProfile, applyProfileFormat, profiles } from '../hardware/profiles'
import type { Pack, PackSourceItem } from '../../types'
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

  ipcMain.handle('packs:upsertSlot', (_, packId: string, slotNumber: number, source: PackSourceItem) => {
    packsDb.upsertSlot(packId, slotNumber, source)
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

    await Promise.all(
      pack.slots.map((slot) =>
        new Promise<void>((resolve, reject) => {
          const outputFile = path.join(outputDir, profile.fileName(slot.slotNumber, slot.displayName))
          const input = ffmpeg(slot.sourcePath)
          if (slot.start !== null && slot.end !== null) {
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
