import { ipcMain, app, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import * as samples from '../db/queries/samples'

const BASE = 'https://freesound.org/apiv2'

function getApiKey(): string {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf-8'))
    return s.freesound_api_key ?? ''
  } catch {
    return ''
  }
}

export function registerFreesoundHandlers(): void {
  ipcMain.handle('freesound:search', async (_, query: string, page = 1) => {
    const token = getApiKey()
    if (!token) throw new Error('No Freesound API key configured')
    const qs = new URLSearchParams({
      query,
      token,
      page: String(page),
      page_size: '20',
      fields: 'id,name,username,duration,previews,tags,license',
    })
    const res = await net.fetch(`${BASE}/search/text/?${qs}`)
    if (!res.ok) throw new Error(`Freesound API error: ${res.status}`)
    return res.json()
  })

  ipcMain.handle('freesound:download', async (_, soundId: number, name: string, previewUrl: string) => {
    const dir = path.join(app.getPath('userData'), 'samples')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const id = crypto.randomUUID()
    const outPath = path.join(dir, `${id}.mp3`)
    const res = await net.fetch(previewUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
    return samples.addSample({
      name: name.replace(/\.[^.]+$/, ''),
      filePath: outPath,
      source: 'freesound',
      freesoundId: String(soundId),
    })
  })
}
