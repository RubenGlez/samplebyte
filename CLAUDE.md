# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start Electron app in development (hot reload)
pnpm tsc          # type-check without emitting
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm prettier:fix # format src/
pnpm build        # full production build (tsc + vite + electron-builder)
pnpm tag patch    # bump version, push main, and push release tag
```

This project uses pnpm (`packageManager` is pinned in `package.json`). There are no tests yet. After any change, `pnpm tsc` is the fastest correctness check.

After `pnpm install`, the `postinstall` script runs `electron-rebuild -f -w better-sqlite3` automatically. If the app crashes on startup with a native module error, re-run `pnpm install` to rebuild.

## Architecture

SampleByte is an Electron 41 + React 19 + TypeScript desktop app. The full vision and technical decisions are in `docs/ARCHITECTURE.md`. The product roadmap is in `docs/ROADMAP.md`. UI design system, color tokens, and macOS conventions are in `docs/DESIGN.md` — read it before touching any UI code.

### Three processes

```
electron/main/      → Node.js, full filesystem + native access
electron/preload/   → bridge (contextBridge only, no business logic)
src/                → React renderer, no Node.js access
```

Communication between renderer and main is **only** through `window.api`, which is defined in the preload and typed in `src/types/global.d.ts`.

### IPC pattern

All IPC uses `invoke`/`handle` — never `send`/`receive`. Every operation is a typed Promise.

```typescript
// renderer — calls window.api directly, or via a Zustand store action
const samples = await window.api.library.getSamples()

// main (electron/main/ipc/*.ts) — registers the handler
ipcMain.handle('library:getSamples', (_, filters?) => {
  return samples.getAllSamples(filters)
})

// preload (electron/preload/index.ts) — one line per operation
getSamples: (filters?) => ipcRenderer.invoke('library:getSamples', filters),
```

Channel naming: `domain:operation` (e.g. `library:getSamples`, `audio:exportRegions`, `fs:pickFolder`).

Adding a new IPC operation requires changes in three places: the handler in `electron/main/ipc/`, the preload bridge in `electron/preload/index.ts`, and the type declaration in `src/types/global.d.ts`.

### State management

Zustand stores live in `src/stores/`. They own async operations — components call store actions, not `window.api` directly.

- `player` — current loaded audio source
- `library` — sample list, search, filters
- `packs` — pack being built, pad slots, hardware profile

### Database

SQLite via `better-sqlite3` (synchronous). Initialised in `electron/main/db/index.ts` before IPC handlers are registered. Queries are in `electron/main/db/queries/` — one file per table. Shared TypeScript types for DB entities live in `electron/types.ts` and are imported by both main and renderer.

### Hardware profiles

Defined in `electron/main/hardware/profiles.ts` as plain config objects — adding a new device is adding one object to the array, no other changes needed. Each profile specifies container format, sample rate, bit depth, and a `fileName` function for pad naming conventions.

### Tailwind

v4 with `@tailwindcss/vite`. No `tailwind.config.js` — theme extensions go in the `@theme {}` block in `src/index.css`. No CSS reset (preflight disabled — only `theme.css` and `utilities.css` are imported).

## Current state

Phase 1 (foundation) is complete. The app loads a local audio file, renders a waveform, supports drag-to-create regions, and can save/export. YouTube integration was intentionally removed.

Phase 2 builds the three-view UI: Chop (current waveform editor), Library (SQLite-backed sample browser), and Packs (4×4 pad grid → hardware export). Freesound API integration is also Phase 2.
