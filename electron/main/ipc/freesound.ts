import { app, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { handle } from './handle'

const BASE = 'https://freesound.org/apiv2'

// The download URL comes from the renderer; restrict it to Freesound's own hosts so this handler
// can't be turned into a fetch-any-URL / SSRF primitive that writes arbitrary content into staging
// (F31). Preview/original URLs live on freesound.org and *.freesound.org (e.g. cdn.freesound.org).
function assertFreesoundUrl(raw: string): void {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid download URL')
  }
  const host = url.hostname
  if (url.protocol !== 'https:' || !(host === 'freesound.org' || host.endsWith('.freesound.org'))) {
    throw new Error(`Refusing to download from ${url.host}`)
  }
}

function getApiKey(): string {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf-8'))
    return s.freesound_api_key ?? ''
  } catch {
    return ''
  }
}

export function registerFreesoundHandlers(): void {
  handle('freesound:search', async (_, query: string, page = 1, sort = 'score', filter = '') => {
    const token = getApiKey()
    if (!token) throw new Error('No Freesound API key configured')
    const params: Record<string, string> = {
      query,
      token,
      page: String(page),
      page_size: '20',
      fields: 'id,name,username,duration,previews,tags,license',
      sort,
    }
    if (filter) params.filter = filter
    const qs = new URLSearchParams(params)
    const res = await net.fetch(`${BASE}/search/text/?${qs}`)
    if (!res.ok) throw new Error(`Freesound API error: ${res.status}`)
    return res.json()
  })

  handle('freesound:download', async (_, _soundId: number, name: string, previewUrl: string) => {
    assertFreesoundUrl(previewUrl)
    const dir = path.join(app.getPath('userData'), 'staging')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const outPath = path.join(dir, `${crypto.randomUUID()}.mp3`)
    const res = await net.fetch(previewUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
    return { name: name.replace(/\.[^.]+$/, ''), filePath: outPath }
  })
}
