import { getDb } from '../index'
import type { Project, ProjectChop, ProjectRegion } from '../../../types'

function deserialize(row: Record<string, unknown>, chops?: ProjectChop[]): Project {
  const id = row.id as string
  return {
    id,
    name: row.name as string,
    sourcePath: row.source_path as string | null,
    sourceName: row.source_name as string | null,
    source: (row.source as 'local' | 'freesound') || 'local',
    freesoundId: row.freesound_id as string | null,
    license: row.license as string | null,
    author: row.author as string | null,
    regions: chops ?? getProjectChops(id),
    createdAt: row.created_at as number,
  }
}

function deserializeChop(row: Record<string, unknown>): ProjectChop {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    start: row.start as number,
    end: row.end as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }
}

export function getAllProjects(): Project[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]
  if (rows.length === 0) return []

  // Load every chop once and group by project, instead of one query per project (N+1).
  // The global ORDER BY matches getProjectChops, so each project's slice stays start-ordered.
  const chopsByProject = new Map<string, ProjectChop[]>()
  for (const row of db.prepare('SELECT * FROM project_chops ORDER BY start, created_at').all() as Record<string, unknown>[]) {
    const chop = deserializeChop(row)
    const list = chopsByProject.get(chop.projectId)
    if (list) list.push(chop)
    else chopsByProject.set(chop.projectId, [chop])
  }

  return rows.map((row) => deserialize(row, chopsByProject.get(row.id as string) ?? []))
}

export function getProject(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserialize(row) : null
}

export function saveProject(data: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; freesoundId?: string | null; license?: string | null; author?: string | null; regions: ProjectRegion[] }): Project {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const source = data.source ?? 'local'
  const freesoundId = data.freesoundId ?? null
  const license = data.license ?? null
  const author = data.author ?? null
  const regions = data.regions.map((region, index) => ({
    ...region,
    id: region.id ?? crypto.randomUUID(),
    projectId: id,
    name: region.name || `Chop ${index + 1}`,
    createdAt,
    updatedAt: createdAt,
  }))

  // The canonical chop store is project_chops (below); the legacy `regions` JSON column is only ever
  // read by the one-time migrateProjectRegionsToChops backfill, so new rows leave it at its '[]'
  // default rather than maintaining a second, drift-prone copy of the same data (F19c).
  db.prepare('INSERT INTO projects (id, name, source_path, source_name, source, freesound_id, license, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    data.name,
    data.sourcePath ?? null,
    data.sourceName ?? null,
    source,
    freesoundId,
    license,
    author,
    createdAt
  )

  const insertChop = db.prepare(`
    INSERT INTO project_chops (id, project_id, name, start, end, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = db.transaction(() => {
    for (const region of regions) {
      insertChop.run(region.id, id, region.name, region.start, region.end, region.createdAt, region.updatedAt)
    }
  })
  tx()

  return { id, name: data.name, sourcePath: data.sourcePath, sourceName: data.sourceName ?? null, source, freesoundId, license, author, regions, createdAt }
}

export function updateProject(id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.sourcePath !== undefined) { fields.push('source_path = ?'); values.push(data.sourcePath) }
  if ('sourceName' in data) { fields.push('source_name = ?'); values.push(data.sourceName) }
  if (data.regions !== undefined) {
    // project_chops is the source of truth; the legacy `regions` JSON column is no longer written
    // (F19c). upsertProjectChops persists the chops themselves.
    upsertProjectChops(id, data.regions)
  }

  if (fields.length === 0) return
  values.push(id)

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteProject(id: string): void {
  const db = getDb()
  // Keep materialized chop-samples in the library; just sever their project link so deleting a
  // project doesn't re-create orphaned project_id references. (project_chops still cascade.)
  db.transaction(() => {
    db.prepare('UPDATE samples SET project_id = NULL WHERE project_id = ?').run(id)
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  })()
}

export function duplicateProject(id: string): Project | null {
  const original = getProject(id)
  if (!original) return null
  return saveProject({
    name: `${original.name} (copy)`,
    sourcePath: original.sourcePath,
    sourceName: original.sourceName,
    source: original.source,
    freesoundId: original.freesoundId,
    license: original.license,
    author: original.author,
    // Drop the source chop ids so the copy gets fresh ones — reusing them violates the
    // project_chops primary key (the originals still exist).
    regions: original.regions.map((r) => ({ start: r.start, end: r.end, name: r.name })),
  })
}

export function getProjectChops(projectId: string): ProjectChop[] {
  return (getDb()
    .prepare('SELECT * FROM project_chops WHERE project_id = ? ORDER BY start, created_at')
    .all(projectId) as Record<string, unknown>[]).map(deserializeChop)
}

export function getAllProjectChops(): Array<ProjectChop & { projectName: string; sourcePath: string | null; source: 'local' | 'freesound'; materializeFailed: boolean; freesoundId: string | null; license: string | null; author: string | null }> {
  return (getDb()
    .prepare(`
      SELECT project_chops.*, projects.name as project_name, projects.source_path, projects.source,
             projects.freesound_id, projects.license, projects.author
      FROM project_chops
      JOIN projects ON projects.id = project_chops.project_id
      ORDER BY projects.created_at DESC, project_chops.start ASC
    `)
    .all() as Record<string, unknown>[]).map((row) => ({
      ...deserializeChop(row),
      projectName: row.project_name as string,
      sourcePath: row.source_path as string | null,
      source: (row.source as 'local' | 'freesound') || 'local',
      materializeFailed: (row.materialize_failed as number) === 1,
      freesoundId: row.freesound_id as string | null,
      license: row.license as string | null,
      author: row.author as string | null,
    }))
}

// Record that a chop's source could not be materialized so the one-time backfill skips it next time
// instead of re-attempting a doomed ffmpeg render on every launch (F14).
export function markChopMaterializeFailed(id: string): void {
  getDb().prepare('UPDATE project_chops SET materialize_failed = 1 WHERE id = ?').run(id)
}

export function upsertProjectChops(projectId: string, regions: ProjectRegion[]): ProjectChop[] {
  const db = getDb()
  const now = Date.now()
  const existing = getProjectChops(projectId)
  const existingById = new Map(existing.map((chop) => [chop.id, chop]))
  const incomingIds = new Set<string>()
  const saved: ProjectChop[] = []

  const upsert = db.prepare(`
    INSERT INTO project_chops (id, project_id, name, start, end, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      start = excluded.start,
      end = excluded.end,
      updated_at = excluded.updated_at
  `)
  const remove = db.prepare('DELETE FROM project_chops WHERE project_id = ? AND id = ?')

  const tx = db.transaction(() => {
    regions.forEach((region, index) => {
      const id = region.id ?? crypto.randomUUID()
      const previous = existingById.get(id)
      const name = region.name || `Chop ${index + 1}`
      const createdAt = previous?.createdAt ?? now
      const changed = !previous || previous.name !== name || previous.start !== region.start || previous.end !== region.end
      const updatedAt = changed ? now : previous.updatedAt
      incomingIds.add(id)
      upsert.run(id, projectId, name, region.start, region.end, createdAt, updatedAt)
      saved.push({ id, projectId, name, start: region.start, end: region.end, createdAt, updatedAt })
    })

    for (const chop of existing) {
      if (!incomingIds.has(chop.id)) remove.run(projectId, chop.id)
    }
  })

  tx()
  return saved
}
