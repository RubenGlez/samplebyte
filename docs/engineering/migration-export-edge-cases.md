# Migration and Export Edge Cases

This document records the expected behavior for the project-chop and pack-slot snapshot migration. It is the manual QA reference until the project has database and export tests.

## Database Migration

### Existing projects with `projects.regions`

Expected behavior:

- On startup, each legacy project region is copied into `project_chops` with a stable ID, name, start, end, `createdAt`, and `updatedAt`.
- Repeated startups do not duplicate migrated chops.
- `projects.regions` remains compatibility data, but normalized `project_chops` is the source used by Library and Pack Builder browsing.

Manual check:

```sql
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM project_chops;
SELECT project_id, COUNT(*) FROM project_chops GROUP BY project_id;
```

### Orphaned project chops

Expected behavior:

- `project_chops.project_id` should always reference an existing project.
- Deleting a project should cascade-delete its normalized chops.
- If local development data predates the normalized table, old project-linked sample rows may need one-time cleanup if their project no longer exists.

Manual check:

```sql
SELECT COUNT(*)
FROM project_chops
WHERE project_id NOT IN (SELECT id FROM projects);
```

### Legacy sample-based pack slots

Expected behavior:

- Older pack slots that referenced only `sample_id` migrate into snapshot columns.
- The migrated snapshot captures source path, display name, sample ID, and project ID when available.
- Export should not require looking up mutable sample metadata except for legacy compatibility.

Manual check:

```sql
PRAGMA table_info(pack_slots);
SELECT source_type, COUNT(*) FROM pack_slots GROUP BY source_type;
```

## Pack Slot Snapshot Export

### Project chop slots

Expected behavior:

- Assignment writes a snapshot containing source path, project ID, project chop ID, display name, start/end, and source chop `updatedAt`.
- Export renders from the snapshot's source path and start/end values.
- Editing the original project chop later does not silently change the slot's export.

Manual check:

1. Assign a project chop to a pad.
2. Edit or rename the original region in Chop.
3. Return to Packs.
4. Confirm the pad shows `Source changed`.
5. Export without refreshing and confirm export uses the old snapshot.
6. Refresh the slot from source and confirm export uses the updated bounds/name.

### Library sample slots

Expected behavior:

- Assignment writes a snapshot containing source path, sample ID, and display name.
- Export renders the full source sample when no start/end is stored.
- Tag/name edits in the Library do not mutate existing slot snapshots unless a future explicit refresh action for samples is added.

### Missing source files

Expected behavior:

- Export should fail clearly if a snapshot source path no longer exists.
- The current UI does not yet preflight missing files before export; this is a known edge case.

Manual check:

1. Assign a chop or sample to a pad.
2. Move or delete the source file outside the app.
3. Export the pack.
4. Confirm the error is visible enough for the user to understand the source file is missing.

## Unified Source Browser

Pack Builder uses one source browser for project regions and loose samples. It should not duplicate project regions into separate Current Project / Other Projects sections. Users narrow the source list through search, project filtering, source filtering, BPM, key, and tags.

Manual check:

1. Create regions in the active project.
2. Open Pack Builder.
3. Confirm those regions appear in the unified source list without saving/exporting to Library.
4. Switch project filters and confirm project-scoped regions appear/disappear correctly.
5. Drag a project region onto a pad and confirm a snapshot slot is written.
