import { getDb } from '../index'
import type { Project, ProjectChop, ProjectRegion } from '../../../types'

function parseRegions(regionsJson: string | null | undefined): Array<{ id: string; [k: string]: unknown }> {
  if (!regionsJson) return []
  try {
    return JSON.parse(regionsJson) as Array<{ id: string; [k: string]: unknown }>
  } catch (error) {
    void error
    return []
  }
}

function deserialize(row: Record<string, unknown>, chops?: ProjectChop[]): Project {
  const id = row.id as string
  return {
    id,
    name: row.name as string,
    sourcePath: row.source_path as string | null,
    sourceName: row.source_name as string | null,
    source: (row.source as 'local' | 'freesound') || 'local',
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

export function saveProject(data: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; regions: ProjectRegion[] }): Project {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const source = data.source ?? 'local'
  const regions = data.regions.map((region, index) => ({
    ...region,
    id: region.id ?? crypto.randomUUID(),
    projectId: id,
    name: region.name || `Chop ${index + 1}`,
    createdAt,
    updatedAt: createdAt,
  }))

  db.prepare('INSERT INTO projects (id, name, source_path, source_name, source, regions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    data.name,
    data.sourcePath ?? null,
    data.sourceName ?? null,
    source,
    JSON.stringify(regions.map(({ id, start, end, name }) => ({ id, start, end, name }))),
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

  return { id, name: data.name, sourcePath: data.sourcePath, sourceName: data.sourceName ?? null, source, regions, createdAt }
}

export function updateProject(id: string, data: Partial<Pick<Project, 'name' | 'sourcePath' | 'regions'>>): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.sourcePath !== undefined) { fields.push('source_path = ?'); values.push(data.sourcePath) }
  if ('sourceName' in data) { fields.push('source_name = ?'); values.push(data.sourceName) }
  if (data.regions !== undefined) {
    const now = Date.now()
    upsertProjectChops(id, data.regions)
    fields.push('regions = ?')
    values.push(JSON.stringify(data.regions.map((region, index) => ({
      id: region.id,
      start: region.start,
      end: region.end,
      name: region.name || `Chop ${index + 1}`,
      updatedAt: 'updatedAt' in region ? region.updatedAt : now,
    }))))
  }

  if (fields.length === 0) return
  values.push(id)

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function duplicateProject(id: string): Project | null {
  const original = getProject(id)
  if (!original) return null
  return saveProject({
    name: `${original.name} (copy)`,
    sourcePath: original.sourcePath,
    regions: original.regions,
  })
}

export function getProjectChops(projectId: string): ProjectChop[] {
  return (getDb()
    .prepare('SELECT * FROM project_chops WHERE project_id = ? ORDER BY start, created_at')
    .all(projectId) as Record<string, unknown>[]).map(deserializeChop)
}

export function getAllProjectChops(): Array<ProjectChop & { projectName: string; sourcePath: string | null; source: 'local' | 'freesound' }> {
  return (getDb()
    .prepare(`
      SELECT project_chops.*, projects.name as project_name, projects.source_path, projects.source
      FROM project_chops
      JOIN projects ON projects.id = project_chops.project_id
      ORDER BY projects.created_at DESC, project_chops.start ASC
    `)
    .all() as Record<string, unknown>[]).map((row) => ({
      ...deserializeChop(row),
      projectName: row.project_name as string,
      sourcePath: row.source_path as string | null,
      source: (row.source as 'local' | 'freesound') || 'local',
    }))
}

export function deleteProjectChop(chopId: string): void {
  const db = getDb()
  const row = db.prepare('SELECT project_id FROM project_chops WHERE id = ?').get(chopId) as { project_id: string } | undefined
  if (!row) return
  const projectId = row.project_id

  db.transaction(() => {
    db.prepare('DELETE FROM pack_slots WHERE project_chop_id = ?').run(chopId)
    db.prepare('DELETE FROM project_chops WHERE id = ?').run(chopId)
    const proj = db.prepare('SELECT regions FROM projects WHERE id = ?').get(projectId) as { regions: string } | undefined
    if (proj) {
      const regions = parseRegions(proj.regions)
      db.prepare('UPDATE projects SET regions = ? WHERE id = ?').run(JSON.stringify(regions.filter((r) => r.id !== chopId)), projectId)
    }
  })()
}

export function renameProjectChop(chopId: string, name: string): void {
  const db = getDb()
  const row = db.prepare('SELECT project_id FROM project_chops WHERE id = ?').get(chopId) as { project_id: string } | undefined
  if (!row) return

  db.transaction(() => {
    db.prepare('UPDATE project_chops SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), chopId)
    const proj = db.prepare('SELECT regions FROM projects WHERE id = ?').get(row.project_id) as { regions: string } | undefined
    if (proj) {
      const regions = parseRegions(proj.regions)
      db.prepare('UPDATE projects SET regions = ? WHERE id = ?').run(
        JSON.stringify(regions.map((r) => r.id === chopId ? { ...r, name } : r)),
        row.project_id
      )
    }
  })()
}

export function getProjectChopPackSlotRefCount(chopId: string): number {
  return ((getDb().prepare('SELECT COUNT(*) as count FROM pack_slots WHERE project_chop_id = ?').get(chopId)) as { count: number }).count
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
