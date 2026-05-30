# 0004 - Autosave replaces explicit project save

**Status**: accepted

## Context

The Chop view previously required users to explicitly click "Save Project" or "Update Project" to persist their region edits. This created a save checkpoint that blocked the primary workflow: users could lose chop work if they navigated away without saving, and the explicit save action added friction between chopping and moving to Pack Builder.

## Options considered

- **Keep explicit save** - familiar pattern, but causes data loss if users forget to save and adds an unnecessary step before pack building.
- **Autosave on every edit** - simplest for users but may cause noticeable UI lag on rapid edits if each change triggers a DB write immediately.
- **Debounced autosave** - batches rapid edits into one write, keeping the database consistent without visible lag and eliminating the need for a manual save action.

## Decision

Project chops autosave on every region create, rename, resize, and delete operation using a 1500ms debounce with a 5s maximum wait. The Chop view header shows a "Saving…" / "✓ Saved" indicator for user-triggered changes. The explicit Save Project and Update Project buttons have been removed.

## Consequences

Users never lose chop work from navigating away. The flow from chopping to pack building is uninterrupted. The save indicator gives confidence that edits are persisted without requiring action. The tradeoff is that "undo" now operates over in-memory state only — there is no "revert to last save" because every state is saved. If undo/redo across sessions becomes a requirement, a version history model (deferred in ADR 0002) would need to be revisited.
