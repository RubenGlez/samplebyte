# Architecture

## Overview

SampleByte is a local-first Electron desktop app. There is no backend, ORM, or cloud runtime. The core domain model is live project chops with stable identity, metadata-first pack slot snapshots, and a library used for search and reuse rather than as a required checkpoint.

The data flow is:

```
Import, record, or open source
  -> project owns live chops
  -> Library/source browser indexes project chops and loose samples
  -> Pack Builder consumes the unified source browser
  -> assigning to a pack slot materializes the pad's own trimmed WAV
  -> export renders each pad's owned file through ffmpeg
  -> target profile writes hardware, software, or folder-ready files
```

When a source chop changes, the UI compares the stored `sourceChopUpdatedAt` on a slot snapshot to the current chop `updatedAt`. Changed slots show an explicit refresh affordance; keeping the snapshot leaves export behavior unchanged.

## Components

### Electron main (`electron/main/`)
Owns privileged and native work:
- SQLite migrations and queries
- File system access and source media operations
- ffmpeg rendering, conversion, and export
- Hardware, software, and folder export profiles
- Freesound API proxying
- Future recording persistence

All audio output flows through a single ffmpeg rendering function, `renderClip` in `electron/main/services/render.ts` — it is the only ffmpeg invocation behind every output (library samples, pad-owned pack audio, and hardware export) and the single `configureFfmpeg()` site. `LIBRARY_FORMAT` (44.1kHz / s16 / stereo) is the canonical library and pack format; hardware export passes the per-profile format (`HardwareProfile.format`).

### Preload (`electron/preload/index.ts`)
Provides a typed `contextBridge` Promise API only. No business logic, persistence decisions, audio logic, or renderer state coordination.

### React renderer (`src/`)
Owns UI, waveform interaction, and user-facing workflow surfaces:
- Chop workspace for source loading, live chops, naming, and refinement
- Pack Builder for assembling slots from the unified source browser
- Library view for project regions, reusable assets, search, filtering, preview, tagging, and cleanup — rows display a waveform miniature in a 120px column
- Global ⌘K command palette (`src/components/CommandPalette.tsx`) for view navigation and file open/import
- Web Workers (`src/workers/`) for off-main-thread computation such as waveform peak extraction

### State stores (Zustand)

| Store | Responsibility |
|---|---|
| `projects` | Live project state, stable chops, source metadata, debounced autosave orchestration. |
| `packs` | Selected pack, slot snapshots, target profile, export orchestration. |
| `library` | Indexed project regions/chops, reusable assets, search, filtering (BPM, key), preview metadata, maintenance actions. |
| `player` | Preview and playback state across sources. |
| `freesound` | Optional source input, search results, download/import state. |
| `ui` | View selection, layout, and ephemeral UI preferences — including the pad audition mode (One-Shot/Gate), which is session-only and never persisted. |

Components call store actions; stores call the typed preload API.

### Pad audition mode
Pads in the Pack screen preview through the `useAudioPlayer` hook (`onPointerDown` plays from the chop's region start, `onPointerUp` stops; playback also auto-stops at `region.end`). A global One-Shot/Gate toggle, held in the `ui` store and defaulting to Gate, changes this preview only: in Gate the release stops playback (current behavior); in One-Shot the release is ignored and the chop plays through to its `region.end`. It is audition-only — not stored on pack slots and not written into exports, so it never touches the persistence or export paths.

### IPC boundary
Renderer-to-main communication uses `ipcRenderer.invoke` and `ipcMain.handle` through the typed preload bridge. Channel names follow `domain:operation` (e.g. `library:getSamples`, `audio:exportRegions`, `fs:pickFolder`). Adding an IPC operation requires: handler in `electron/main/ipc/`, method in `electron/preload/index.ts`, and declaration in `src/types/global.d.ts`.

### Persistence
SQLite via `better-sqlite3` (synchronous), initialized in `electron/main/db/index.ts`. Queries live in `electron/main/db/queries/` — one file per table. Shared TypeScript types live in `electron/types.ts`.

Tables:
- `projects` — source metadata, source path
- `project_chops` — stable chop IDs, project_id, name, start, end, created_at, updated_at
- `samples` — loose/reusable library assets
- `packs` — pack metadata
- `pack_slots` — metadata-first snapshots: source type/path, optional project/chop/sample references, region bounds, display name, sourceChopUpdatedAt, owned trimmed audio (`audio_path`), export settings

Each pad owns its audio (ADR 0006). On assignment the slot materializes its own trimmed WAV at `pack_slots.audio_path` through the shared rendering path, and export renders from that owned file. Legacy slots with no owned audio still trim from `source_path` at export.

### Local media
Renderer code does not read native paths through `file://`. Local audio is exposed through the `local-file://` protocol registered in Electron main. Build renderer-safe URLs with `toLocalFileUrl()` from `src/utils/index.ts`.

`app.setName('samplebyte')` is called in `electron/main/index.ts` so both dev (`pnpm dev`) and production builds always use `~/Library/Application Support/samplebyte/` as the userData directory. Before this call was added, dev mode landed in `~/Library/Application Support/Electron/` instead.

### Audio analysis
BPM, key, and transient detection run in the renderer using the Web Audio API and custom algorithms in `src/lib/audioAnalysis.ts`. Analysis is offline and local. Waveform peak extraction runs in a shared Web Worker (`src/workers/waveformPeaks.worker.ts`); decoded `AudioBuffer` objects are cached by URL in `src/hooks/useChopWaveform.ts` so multiple chops from the same file share one decode pass.

### Freesound
Remains an optional source input. The API key stays in Electron main; requests are proxied through `freesound:*` IPC handlers so credentials are never exposed to the renderer.

## Data flow

See Overview above for the end-to-end diagram.

Export stays in Electron main. The renderer selects a pack and target profile, then calls the preload API. Main loads the pack and its slots, applies the target profile, and renders each pad's owned trimmed file via ffmpeg (legacy slots without owned audio trim from `source_path`). Target profiles cover hardware devices, software-oriented outputs, and plain folders; the profile owns naming, format, sample rate, bit depth, and future per-target export settings.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript across Electron main, preload, and renderer. |
| Runtime | Electron 41 with Node in main and Chromium in renderer. |
| UI | React 19. |
| Build | Vite and `vite-plugin-electron`. |
| State | Zustand. |
| Database | `better-sqlite3` with migrations. |
| Audio UI | WaveSurfer.js. |
| Audio processing | `fluent-ffmpeg` with bundled ffmpeg installer. |
| Audio analysis | Custom Web Audio API BPM, key, and transient analysis. |
| Styling | Tailwind CSS v4 tokens in `src/index.css`, shadcn/Radix primitives, `lucide-react` icons. |

Commands:
- `pnpm dev` — start Electron in development (hot reload)
- `pnpm tsc` — type-check without emitting (fastest correctness check)
- `pnpm test` — run the vitest suite (audio-rendering modules against real ffmpeg)
- `pnpm lint` — ESLint
- `pnpm build` — TypeScript + Vite + Electron Builder
- `pnpm seed` — populate the database with demo data (run `pnpm dev` once first)

## Key decisions

1. Keep the Electron/local-first architecture and refactor inside it — no platform rewrite.
2. Give project chops stable IDs and `updatedAt` timestamps; do not add full version history yet.
3. Store pack slots as metadata-first snapshots rendered on export; do not duplicate or render audio on assignment.
4. Treat the Library as the indexed source browser for project regions and loose samples, not a mandatory export step in the happy path.
5. Keep Pack Builder source browsing unified rather than splitting Current Project, Other Projects, and Library into separate sections.

## Open questions

- Should source media eventually be consolidated into app-managed storage so old packs remain robust when originals move?

## Testing

Vitest is the test runner (`pnpm test`). The audio-rendering modules are covered against real ffmpeg using the bundled seed fixtures (`scripts/seed-audio/`). Database-dependent code is not unit-testable: `better-sqlite3` is built for Electron's ABI, so constructing a Database under plain Node fails with a NODE_MODULE_VERSION mismatch — migration, query, and export-snapshot tests remain a gap.
