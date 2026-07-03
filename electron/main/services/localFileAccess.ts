import { app } from 'electron'
import path from 'node:path'
import { getDb } from '../db/index'

// Gate for the `local-file://` protocol. Without it any renderer script could `fetch` an arbitrary
// path — the protocol is CORS-open and bypasses CSP — turning a renderer bug into a full-disk read
// (F32). A path is served only when the app has a legitimate reason to expose it:
//   1. it lives under userData (rendered samples, trimmed sources, staging, stems, pack audio), or
//   2. a DB row references it (imported-in-place library files, project sources, pad audio), or
//   3. main explicitly brokered it this session (a file the user just picked or dropped, before it
//      has been persisted to any row).
const brokered = new Set<string>()

// Record a path the renderer legitimately obtained through main (file picker) or told us it just
// loaded (drag-drop). Cheap and idempotent.
export function allowLocalPath(filePath: string | null | undefined): void {
  if (filePath) brokered.add(path.resolve(filePath))
}

function underUserData(resolved: string): boolean {
  const base = path.resolve(app.getPath('userData')) + path.sep
  return resolved === path.resolve(app.getPath('userData')) || resolved.startsWith(base)
}

function knownToDb(candidate: string): boolean {
  try {
    return !!getDb()
      .prepare(`
        SELECT 1 FROM samples WHERE file_path = ?
        UNION SELECT 1 FROM projects WHERE source_path = ?
        UNION SELECT 1 FROM pack_slots WHERE audio_path = ?
        LIMIT 1
      `)
      .get(candidate, candidate, candidate)
  } catch {
    return false
  }
}

// True when the protocol handler is allowed to serve `filePath`. Resolving first collapses any
// `..` traversal so an escape attempt falls through to the DB/brokered checks and is denied.
export function isLocalFileAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  if (underUserData(resolved)) return true
  if (brokered.has(resolved)) return true
  return knownToDb(filePath) || knownToDb(resolved)
}
