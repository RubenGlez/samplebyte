import { getDb } from '../index'
import type { Project, ProjectRegion } from '../../../types'

function deserialize(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    sourcePath: row.source_path as string | null,
    regions: JSON.parse((row.regions as string) || '[]') as ProjectRegion[],
    createdAt: row.created_at as number,
  }
}

export function getAllProjects(): Project[] {
  return (getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(deserialize)
}

export function getProject(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserialize(row) : null
}

export function saveProject(data: Pick<Project, 'name' | 'sourcePath' | 'regions'>): Project {
  const db = getDb()
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  db.prepare('INSERT INTO projects (id, name, source_path, regions, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    data.name,
    data.sourcePath ?? null,
    JSON.stringify(data.regions),
    createdAt
  )

  return { id, ...data, createdAt }
}

export function updateProject(id: string, data: Partial<Pick<Project, 'name' | 'regions'>>): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.regions !== undefined) { fields.push('regions = ?'); values.push(JSON.stringify(data.regions)) }

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
