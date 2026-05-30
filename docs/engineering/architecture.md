---
title: SampleByte Architecture Plan
product: SampleByte
status: draft
---

# Architecture

SampleByte remains a local-first Electron desktop app. The implementation plan is an incremental refactor inside the current runtime, not a platform rewrite. There is no backend, ORM, or new runtime in this plan.

The core domain model moves from anonymous project regions plus library samples to live project chops with stable identity, metadata-first pack slot snapshots, and a library/archive used for search and reuse rather than as a required checkpoint.

## Process Boundaries

### Electron main

Owns privileged and native work:

- SQLite migrations and queries.
- File system access and source media operations.
- ffmpeg rendering, conversion, and export.
- Hardware, software, and folder export profiles.
- Freesound API proxying.
- Future recording persistence.

### Preload

Provides a typed `contextBridge` Promise API only. It should not contain business logic, persistence decisions, audio logic, or renderer state coordination.

### React renderer

Owns UI, waveform interaction, and user-facing workflow surfaces:

- Chop workspace for source loading, recording entry points, live chops, naming, and refinement.
- Pack Builder for assembling slots from the unified source browser of project chops and loose samples.
- Library/source management for project regions, reusable assets, search, filtering, preview, tagging, and cleanup.

## State Stores

Zustand remains the renderer state layer.

| Store | Responsibility |
| --- | --- |
| `projects` | Live project state, stable chops, source metadata, autosave orchestration. |
| `packs` | Selected pack, slot snapshots, target profile, export orchestration. |
| `library` | Indexed project regions/chops, reusable assets, search, filtering, preview metadata, maintenance actions. |
| `player` | Preview and playback state across sources. |
| `freesound` | Optional source input, search results, download/import state. |

Components should call store actions; stores call the typed preload API.

## IPC Boundary

Renderer-to-main communication uses `ipcRenderer.invoke` and `ipcMain.handle` through the typed preload bridge. Do not use `send`/`receive` channels or direct Node access from the renderer.

Channel names follow `domain:operation`, for example `library:getSamples`, `audio:exportRegions`, and `fs:pickFolder`.

Adding an IPC operation requires the same three updates:

1. Register the handler in `electron/main/ipc/`.
2. Expose the method in `electron/preload/index.ts`.
3. Add the TypeScript declaration in `src/types/global.d.ts`.

## Persistence Model

SQLite stores:

- Projects and source metadata.
- Stable project chops with IDs and `updatedAt` timestamps in a normalized `project_chops` table.
- Loose/reusable samples for the Library/source browser.
- Packs.
- Metadata-first pack slot snapshots.

Project chops need stable IDs so Pack Builder can reference live work directly. Chops also need `updatedAt` timestamps so pack slots can detect when their source has changed.

Pack slot snapshots store metadata, not eager audio renders:

- Source type and source path.
- Project and chop references when present.
- Region bounds.
- Display name.
- Source `updatedAt` at assignment time.
- Export settings.

Assignment to a pack slot should not physically copy or render audio. Export reads the snapshot and source media when the user chooses a target output.

The current database uses `better-sqlite3` in Electron main, with the database file stored under Electron's `app.getPath('userData')`. Migrations run from `electron/main/db/index.ts`, and query modules live under `electron/main/db/queries/`.

## Data Flow

```text
Import, record, or open source
  -> project owns live chops
  -> Library/source browser indexes project chops and loose samples
  -> Pack Builder consumes the unified source browser
  -> assigning to a pack slot writes a metadata snapshot
  -> export renders from snapshots and source media through ffmpeg
  -> target profile writes hardware, software, or folder-ready files
```

When a source chop changes, the UI compares the stored `sourceChopUpdatedAt` on a slot snapshot to the current chop `updatedAt`. Changed slots show an explicit refresh affordance; keeping the snapshot leaves export behavior unchanged.

## Export Pipeline

Export remains in Electron main. The renderer selects a pack and target profile, then calls the preload API. Main loads the pack, slot snapshots, and source media references, applies the target profile, and renders each slot via ffmpeg.

Target profiles cover hardware devices, software-oriented outputs, and plain folders. The profile owns naming, format, sample rate, bit depth, and any future per-target export settings.

Hardware and target profiles live in `electron/main/hardware/profiles.ts`. Adding a new target should remain a configuration change whenever possible. Export callers should use `applyProfileFormat(profile, cmd)` instead of reading profile format internals directly.

## Local Media

Renderer code does not read native paths directly through `file://`. Local audio is exposed through the privileged `local-file://` protocol registered in Electron main, so WaveSurfer, `<audio>`, and fetch-based analysis can load the same media with the right CORS behavior.

When a user drops a file, the renderer asks the preload bridge for the native path via Electron `webUtils`. Build renderer-safe URLs with `toLocalFileUrl()` from `src/utils/index.ts`; do not concatenate native paths by hand.

## Audio Analysis

BPM, key, and transient detection stay in the renderer using the Web Audio API and the custom algorithms in `src/lib/audioAnalysis.ts`. Analysis remains offline and local. Results can be persisted to project chops, reusable library samples, or future snapshot metadata when needed.

## Freesound

Freesound remains an optional source input rather than the core product promise. The API key stays in Electron main, and requests are proxied through `freesound:*` IPC handlers so credentials are never exposed to the renderer.

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript across Electron main, preload, and renderer. |
| Runtime | Electron 41 with Node in main and Chromium in renderer. |
| UI | React 19. |
| Build | Vite and `vite-plugin-electron`. |
| State | Zustand. |
| Database | `better-sqlite3` with migrations. |
| Storage | Local source/media paths remain local; future media consolidation is open. |
| Audio UI | WaveSurfer.js. |
| Audio processing | `fluent-ffmpeg` with bundled ffmpeg installer. |
| Audio analysis | Current custom Web Audio API BPM, key, and transient analysis. |
| Styling | Tailwind CSS v4 tokens in `src/index.css`, shadcn/Radix primitives, and `lucide-react` icons. |

## Commands

- `pnpm dev` starts the Electron app in development.
- `pnpm tsc` type-checks without emitting and is the fastest correctness check.
- `pnpm lint` runs ESLint.
- `pnpm build` runs TypeScript, Vite build, and Electron Builder.

## Key Decisions

1. Keep the Electron/local-first architecture and refactor inside it.
2. Give project chops stable IDs and `updatedAt` timestamps; do not add full version history yet.
3. Store pack slots as metadata-first snapshots rendered on export; do not duplicate or render audio on assignment.
4. Treat the Library as the indexed source browser for project regions and loose samples, not a mandatory export step in the happy path.
5. Keep Pack Builder source browsing unified rather than splitting Current Project, Other Projects, and Library into separate sections.

## Open Questions

- Should source media eventually be consolidated into app-managed storage so old packs remain robust when originals move?
- What automated test framework should be added?

The implementation plan uses a normalized `project_chops` table so current-project and cross-project browsing share the same query path. Existing `projects.regions` JSON should be treated as migration input and compatibility surface, not the long-term source of truth.

For testing, the fastest current check is `pnpm tsc`. If a test runner is introduced, start with typed query and store tests around project chops, pack slot snapshots, and export payload construction.
