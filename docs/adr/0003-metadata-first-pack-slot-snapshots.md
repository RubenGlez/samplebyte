# 0003 - Metadata-first pack slot snapshots

**Status**: accepted

## Context

Pack slots currently point at library sample IDs. The product direction removes Save to Library as the required happy-path checkpoint, so slots must accept current project chops, other project chops, and loose library samples. Existing packs should not silently change when source chops are edited.

## Options considered

- **Live links to source chops or samples** - easy to keep current, but existing packs can silently change when source material is edited.
- **Eager rendered files on assignment** - stable and simple to export, but wastes disk, slows assignment, and bakes export settings too early.
- **Metadata-first snapshots rendered on export** - stable slots without copying audio at assignment time, while preserving enough source metadata for later refresh and profile-based export.

## Decision

Pack slots store metadata-first snapshots. Assignment captures source type/path, optional project and chop references, optional sample reference, region start/end, display name, source chop `updatedAt`, and export settings such as pitch or time stretch when those options exist. Export renders from the snapshot with ffmpeg and the selected target profile.

## Consequences

Packs stay stable by default, assignment remains fast, and users can intentionally update slots from changed source chops. Export logic becomes responsible for resolving snapshot metadata and handling missing files or migrated older slots, so migration and export edge cases need focused verification.
