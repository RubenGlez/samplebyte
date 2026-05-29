# 0002 - Stable project chops

**Status**: accepted

## Context

Current projects store anonymous regions as JSON. The new workflow needs current project chops to appear immediately in Pack Builder, other project chops to be browsable, and pack slots to know when a source chop changed. Anonymous regions are not addressable enough for cross-project browsing or source-change detection.

## Options considered

- **Keep anonymous project regions** - smallest code change, but cannot reliably reference chops from packs or detect source edits.
- **Use stable chop IDs with `updatedAt`** - gives Pack Builder and pack slots a durable reference and a simple source-change signal.
- **Add full chop version history** - supports precise historical reconstruction, but adds storage and UI complexity before users need it.

## Decision

Represent project chops with stable IDs and `updatedAt` timestamps. Migrate existing `projects.regions` JSON into compatible project chop records, preferably through a normalized `project_chops` table so current-project and cross-project browsing share the same query path.

## Consequences

Pack Builder can browse and assign project chops directly, and pack slots can compare a stored source timestamp with the current chop timestamp. This intentionally avoids full version history for now, so the stable pack behavior must come from slot snapshots rather than reconstructing every old chop state.
