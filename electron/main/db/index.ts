import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

let db: Database.Database

export function initDatabase(): void {
  const dataPath = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true })

  db = new Database(path.join(dataPath, 'samplebyte.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL,
      file_path     TEXT    UNIQUE NOT NULL,
      duration      REAL,
      bpm           REAL,
      musical_key   TEXT,
      tags          TEXT    NOT NULL DEFAULT '[]',
      source        TEXT    NOT NULL DEFAULT 'local',
      freesound_id  TEXT,
      waveform_data TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packs (
      id               TEXT    PRIMARY KEY,
      name             TEXT    NOT NULL,
      hardware_profile TEXT    NOT NULL,
      created_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pack_slots (
      pack_id     TEXT    NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
      slot_number INTEGER NOT NULL,
      sample_id   TEXT    NOT NULL REFERENCES samples(id),
      PRIMARY KEY (pack_id, slot_number)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL,
      source_path TEXT,
      regions     TEXT    NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_chops (
      id          TEXT    PRIMARY KEY,
      project_id  TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      start       REAL    NOT NULL,
      end         REAL    NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `)

  const sampleCols = (db.prepare('PRAGMA table_info(samples)').all() as { name: string }[]).map((c) => c.name)
  if (!sampleCols.includes('project_id')) {
    db.exec('ALTER TABLE samples ADD COLUMN project_id TEXT')
  }

  const projectCols = (db.prepare('PRAGMA table_info(projects)').all() as { name: string }[]).map((c) => c.name)
  if (!projectCols.includes('source_name')) {
    db.exec('ALTER TABLE projects ADD COLUMN source_name TEXT')
  }
  if (!projectCols.includes('source')) {
    db.exec("ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'local'")
  }

  migrateProjectRegionsToChops()
  migratePackSlotsToSnapshots()
}

function migrateProjectRegionsToChops(): void {
  const projects = db.prepare('SELECT id, regions, created_at FROM projects').all() as {
    id: string
    regions: string
    created_at: number
  }[]
  const existing = db.prepare('SELECT COUNT(*) as count FROM project_chops WHERE project_id = ?')
  const insert = db.prepare(`
    INSERT OR IGNORE INTO project_chops (id, project_id, name, start, end, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    for (const project of projects) {
      const count = (existing.get(project.id) as { count: number }).count
      if (count > 0) continue

      let regions: Array<{ id?: string; name?: string; start?: number; end?: number }>
      try {
        regions = JSON.parse(project.regions || '[]') as Array<{ id?: string; name?: string; start?: number; end?: number }>
      } catch {
        regions = []
      }

      regions.forEach((region, index) => {
        if (typeof region.start !== 'number' || typeof region.end !== 'number') return
        const id = region.id || `${project.id}:region:${index}`
        insert.run(
          id,
          project.id,
          region.name || `Chop ${index + 1}`,
          region.start,
          region.end,
          project.created_at,
          project.created_at
        )
      })
    }
  })

  tx()
}

function migratePackSlotsToSnapshots(): void {
  const slotCols = (db.prepare('PRAGMA table_info(pack_slots)').all() as { name: string }[]).map((c) => c.name)
  if (slotCols.includes('source_type')) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS pack_slots_new (
      pack_id                TEXT    NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
      slot_number            INTEGER NOT NULL,
      source_type            TEXT    NOT NULL,
      source_path            TEXT    NOT NULL,
      project_id             TEXT,
      project_chop_id        TEXT,
      sample_id              TEXT,
      start                  REAL,
      end                    REAL,
      display_name           TEXT    NOT NULL,
      source_chop_updated_at INTEGER,
      pitch_shift_semitones  REAL,
      time_stretch_ratio     REAL,
      PRIMARY KEY (pack_id, slot_number)
    );

    INSERT OR REPLACE INTO pack_slots_new (
      pack_id,
      slot_number,
      source_type,
      source_path,
      project_id,
      project_chop_id,
      sample_id,
      start,
      end,
      display_name,
      source_chop_updated_at,
      pitch_shift_semitones,
      time_stretch_ratio
    )
    SELECT
      ps.pack_id,
      ps.slot_number,
      'library-sample',
      s.file_path,
      s.project_id,
      NULL,
      ps.sample_id,
      NULL,
      NULL,
      s.name,
      NULL,
      NULL,
      NULL
    FROM pack_slots ps
    JOIN samples s ON s.id = ps.sample_id;

    DROP TABLE pack_slots;
    ALTER TABLE pack_slots_new RENAME TO pack_slots;
  `)
}
