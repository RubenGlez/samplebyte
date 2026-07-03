import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getDb } from '../db/index'

// App-owned directories whose files are always referenced by exactly one DB row. `stems/` is
// deliberately excluded: it is a content-addressed cache keyed by source hash, referenced only by
// its presence on disk (see services/stems getCachedStems), not by any row.
const MANAGED_DIRS = ['samples', 'sources', 'staging', 'pack-slots']

// Every file path the database still points at: rendered library samples, pad-owned pack audio, and
// project source files (trimmed sources under sources/, Freesound previews under staging/).
function referencedPaths(): Set<string> {
  const db = getDb()
  const paths = new Set<string>()
  for (const r of db.prepare('SELECT file_path FROM samples').all() as { file_path: string }[]) paths.add(r.file_path)
  for (const r of db.prepare('SELECT audio_path FROM pack_slots WHERE audio_path IS NOT NULL').all() as { audio_path: string }[]) paths.add(r.audio_path)
  for (const r of db.prepare('SELECT source_path FROM projects WHERE source_path IS NOT NULL').all() as { source_path: string }[]) paths.add(r.source_path)
  return paths
}

// Sweep the app-owned directories for files no DB row references and unlink them. Covers the leaks
// the audit calls out: orphaned pad WAVs from racing/crashing upsertSlot (F15), re-trimmed sources,
// deleted-project staging files, and any render left behind by a crash between write and DB commit
// (F21). Conservative by construction — it only ever touches files under MANAGED_DIRS, never a
// user's own imported files (which live outside userData) or the stem cache.
export function gcOrphanedFiles(): { removed: number } {
  const referenced = referencedPaths()
  const userData = app.getPath('userData')
  let removed = 0

  for (const dirName of MANAGED_DIRS) {
    const dir = path.join(userData, dirName)
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue // dir doesn't exist yet
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const full = path.join(dir, entry.name)
      if (referenced.has(full)) continue
      try {
        fs.unlinkSync(full)
        removed++
      } catch {
        // Locked/already gone — leave it for the next sweep.
      }
    }
  }

  return { removed }
}
