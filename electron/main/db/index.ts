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
  `)
}
