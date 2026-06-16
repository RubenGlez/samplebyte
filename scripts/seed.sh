#!/usr/bin/env bash
# Seed script for demo/dev data.
# Prerequisite: run `pnpm dev` at least once so the DB and tables exist.
# Audio files are bundled in scripts/seed-audio/ — no API keys required.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_AUDIO_DIR="$SCRIPT_DIR/seed-audio"

# ── 1. Locate userData ──────────────────────────────────────────────────────
if [ -d "$HOME/Library/Application Support/samplebyte" ]; then
  USERDATA="$HOME/Library/Application Support/samplebyte"
elif [ -d "$HOME/Library/Application Support/Electron" ]; then
  USERDATA="$HOME/Library/Application Support/Electron"
else
  echo "Error: userData directory not found." >&2
  echo "Run 'pnpm dev' at least once first." >&2
  exit 1
fi

DB="$USERDATA/data/samplebyte.db"
SAMPLES_DIR="$USERDATA/samples"

if [ ! -f "$DB" ]; then
  echo "Error: database not found at $DB." >&2
  echo "Run 'pnpm dev' at least once first." >&2
  exit 1
fi

echo "Using database: $DB"

# ── 2. Copy bundled audio files to userData ─────────────────────────────────
mkdir -p "$SAMPLES_DIR"

AMEN_PATH="$SAMPLES_DIR/seed-amen-break.mp3"
THINK_PATH="$SAMPLES_DIR/seed-think-break.mp3"

echo "Copying seed audio files..."
cp "$SEED_AUDIO_DIR/amen-break.mp3"  "$AMEN_PATH"
cp "$SEED_AUDIO_DIR/think-break.mp3" "$THINK_PATH"
echo "  $AMEN_PATH"
echo "  $THINK_PATH"

# ── 3. Apply schema migrations ──────────────────────────────────────────────
echo "Checking schema..."

PROJ_COLS=$(sqlite3 "$DB" "PRAGMA table_info(projects);" | awk -F'|' '{print $2}')
if ! echo "$PROJ_COLS" | grep -q "source_name"; then
  echo "  Adding source_name column to projects..."
  sqlite3 "$DB" "ALTER TABLE projects ADD COLUMN source_name TEXT;"
fi
if ! echo "$PROJ_COLS" | grep -qw "source"; then
  echo "  Adding source column to projects..."
  sqlite3 "$DB" "ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'local';"
fi

SLOT_COLS=$(sqlite3 "$DB" "PRAGMA table_info(pack_slots);" | awk -F'|' '{print $2}')
if ! echo "$SLOT_COLS" | grep -q "source_type"; then
  echo "  Migrating pack_slots to snapshot schema..."
  sqlite3 "$DB" "
    CREATE TABLE pack_slots_new (
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
    DROP TABLE pack_slots;
    ALTER TABLE pack_slots_new RENAME TO pack_slots;
  "
fi

sqlite3 "$DB" "
  CREATE TABLE IF NOT EXISTS project_chops (
    id          TEXT    PRIMARY KEY,
    project_id  TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    start       REAL    NOT NULL,
    end         REAL    NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
"

# ── 4. Wipe existing data and insert seed ───────────────────────────────────
echo "Clearing existing data..."
sqlite3 "$DB" "
  PRAGMA foreign_keys = OFF;
  DELETE FROM pack_slots;
  DELETE FROM packs;
  DELETE FROM project_chops;
  DELETE FROM projects;
  PRAGMA foreign_keys = ON;
"

echo "Inserting seed data..."
sqlite3 "$DB" "
  PRAGMA foreign_keys = ON;

  -- Project 1: Amen Break
  INSERT INTO projects (id, name, source_path, source_name, source, regions, created_at) VALUES (
    'seed-proj-amen-000000000001',
    'Amen Break',
    '$AMEN_PATH',
    'Amen Brother (The Winstons)',
    'local',
    '[]',
    1735689600000
  );

  INSERT INTO project_chops (id, project_id, name, start, end, created_at, updated_at) VALUES
    ('seed-chop-amen-01', 'seed-proj-amen-000000000001', 'Kick',          0.000, 0.550, 1735689600000, 1735689600000),
    ('seed-chop-amen-02', 'seed-proj-amen-000000000001', 'Snare 1',       0.550, 1.100, 1735689600000, 1735689600000),
    ('seed-chop-amen-03', 'seed-proj-amen-000000000001', 'Hi-Hat Closed', 1.100, 1.660, 1735689600000, 1735689600000),
    ('seed-chop-amen-04', 'seed-proj-amen-000000000001', 'Open Hat',      1.660, 2.210, 1735689600000, 1735689600000),
    ('seed-chop-amen-05', 'seed-proj-amen-000000000001', 'Kick + Snare',  2.210, 2.760, 1735689600000, 1735689600000),
    ('seed-chop-amen-06', 'seed-proj-amen-000000000001', 'Ghost Snare',   2.760, 3.310, 1735689600000, 1735689600000),
    ('seed-chop-amen-07', 'seed-proj-amen-000000000001', 'Snare 2',       3.310, 3.870, 1735689600000, 1735689600000),
    ('seed-chop-amen-08', 'seed-proj-amen-000000000001', 'Crash + Kick',  3.870, 4.420, 1735689600000, 1735689600000);

  -- Project 2: Think Break
  INSERT INTO projects (id, name, source_path, source_name, source, regions, created_at) VALUES (
    'seed-proj-think-00000000002',
    'Think Break',
    '$THINK_PATH',
    'Think (About It) (Lyn Collins)',
    'local',
    '[]',
    1735776000000
  );

  INSERT INTO project_chops (id, project_id, name, start, end, created_at, updated_at) VALUES
    ('seed-chop-think-01', 'seed-proj-think-00000000002', 'Kick',      0.000, 0.860, 1735776000000, 1735776000000),
    ('seed-chop-think-02', 'seed-proj-think-00000000002', 'Snare',     0.860, 1.790, 1735776000000, 1735776000000),
    ('seed-chop-think-03', 'seed-proj-think-00000000002', 'Rim Shot',  1.790, 2.560, 1735776000000, 1735776000000),
    ('seed-chop-think-04', 'seed-proj-think-00000000002', 'Hi-Hat',    2.560, 3.590, 1735776000000, 1735776000000),
    ('seed-chop-think-05', 'seed-proj-think-00000000002', 'Open Hat',  3.590, 4.780, 1735776000000, 1735776000000),
    ('seed-chop-think-06', 'seed-proj-think-00000000002', 'Floor Tom', 4.780, 5.970, 1735776000000, 1735776000000),
    ('seed-chop-think-07', 'seed-proj-think-00000000002', 'Full Bar',  5.970, 7.180, 1735776000000, 1735776000000);

  -- Pack 1: Hip Hop Kit Vol.1 (SP-404 MkII)
  INSERT INTO packs (id, name, hardware_profile, created_at)
  VALUES ('seed-pack-hiphop-0000000001', 'Hip Hop Kit Vol.1', 'sp404-mkii', 1735862400000);

  INSERT INTO pack_slots (pack_id, slot_number, source_type, source_path, project_id, project_chop_id, sample_id, start, end, display_name, source_chop_updated_at, pitch_shift_semitones, time_stretch_ratio) VALUES
    ('seed-pack-hiphop-0000000001', 1,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-01', NULL, 0.000, 0.550, 'Kick',           1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 2,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-02', NULL, 0.550, 1.100, 'Snare 1',        1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 3,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-03', NULL, 1.100, 1.660, 'Hi-Hat Closed',  1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 4,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-04', NULL, 1.660, 2.210, 'Open Hat',       1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 5,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-05', NULL, 2.210, 2.760, 'Kick + Snare',   1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 6,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-06', NULL, 2.760, 3.310, 'Ghost Snare',    1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 7,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-07', NULL, 3.310, 3.870, 'Snare 2',        1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 8,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-08', NULL, 3.870, 4.420, 'Crash + Kick',   1735689600000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 9,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-01', NULL, 0.000, 0.860, 'Kick (Think)',   1735776000000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 10, 'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-02', NULL, 0.860, 1.790, 'Snare (Think)',  1735776000000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 11, 'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-04', NULL, 2.560, 3.590, 'Hi-Hat (Think)', 1735776000000, NULL, NULL),
    ('seed-pack-hiphop-0000000001', 12, 'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-06', NULL, 4.780, 5.970, 'Floor Tom',      1735776000000, NULL, NULL);

  -- Pack 2: Golden Era Drums (Maschine MK3)
  INSERT INTO packs (id, name, hardware_profile, created_at)
  VALUES ('seed-pack-golden-000000002', 'Golden Era Drums', 'maschine-mk3', 1735948800000);

  INSERT INTO pack_slots (pack_id, slot_number, source_type, source_path, project_id, project_chop_id, sample_id, start, end, display_name, source_chop_updated_at, pitch_shift_semitones, time_stretch_ratio) VALUES
    ('seed-pack-golden-000000002', 1,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-01', NULL, 0.000, 0.860, 'Kick',               1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 2,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-02', NULL, 0.860, 1.790, 'Snare',              1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 3,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-03', NULL, 1.790, 2.560, 'Rim Shot',           1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 4,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-04', NULL, 2.560, 3.590, 'Hi-Hat',             1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 5,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-05', NULL, 3.590, 4.780, 'Open Hat',           1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 6,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-06', NULL, 4.780, 5.970, 'Floor Tom',          1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 7,  'project-chop', '$THINK_PATH', 'seed-proj-think-00000000002', 'seed-chop-think-07', NULL, 5.970, 7.180, 'Full Bar',           1735776000000, NULL, NULL),
    ('seed-pack-golden-000000002', 8,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-01', NULL, 0.000, 0.550, 'Kick (Amen)',        1735689600000, NULL, NULL),
    ('seed-pack-golden-000000002', 9,  'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-02', NULL, 0.550, 1.100, 'Snare (Amen)',       1735689600000, NULL, NULL),
    ('seed-pack-golden-000000002', 10, 'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-04', NULL, 1.660, 2.210, 'Open Hat (Amen)',    1735689600000, NULL, NULL),
    ('seed-pack-golden-000000002', 11, 'project-chop', '$AMEN_PATH', 'seed-proj-amen-000000000001', 'seed-chop-amen-06', NULL, 2.760, 3.310, 'Ghost Snare (Amen)', 1735689600000, NULL, NULL);
"

echo ""
echo "Done!"
sqlite3 "$DB" "SELECT 'Projects: ' || COUNT(*) FROM projects;"
sqlite3 "$DB" "SELECT 'Project chops: ' || COUNT(*) FROM project_chops;"
sqlite3 "$DB" "SELECT 'Packs: ' || COUNT(*) FROM packs;"
sqlite3 "$DB" "SELECT 'Pack slots: ' || COUNT(*) FROM pack_slots;"
echo ""
echo "Restart the app to see the seed data."
