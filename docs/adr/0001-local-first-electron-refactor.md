# 0001 - Local-first Electron refactor

**Status**: accepted

## Context

SampleByte already works as a local-first Electron desktop app with React renderer UI, a typed preload bridge, SQLite via `better-sqlite3`, filesystem access, ffmpeg export, WaveSurfer editing, and Freesound integration in Electron main. The next product direction changes project, chop, library, and pack semantics, but it does not require a platform rewrite.

## Options considered

- **Incremental local-first Electron refactor** - preserves current runtime, native access, desktop distribution, and most working code while changing the data model and workflow.
- **Backend or cloud-backed rewrite** - could centralize persistence and sync later, but adds auth, hosting, network failure, privacy, and latency work that does not serve the current offline producer workflow.
- **Alternative desktop runtime rewrite** - could reduce Electron footprint, but would force a large migration before solving the Save to Library and Pack Builder model problems.

## Decision

Continue with an incremental local-first Electron architecture. Electron main remains responsible for SQLite, filesystem, ffmpeg, export, Freesound, and future recording persistence. Preload remains a typed `contextBridge` only. React and Zustand remain responsible for renderer UI state and workflow orchestration.

## Consequences

This keeps the refactor focused on product semantics instead of platform migration, and it preserves existing packaging, hardware profile export, WaveSurfer integration, and local file handling. It also means multi-device sync, web access, and cloud collaboration remain out of scope unless a future product decision justifies new infrastructure.
