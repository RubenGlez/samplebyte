# Architecture

This document covers the technical decisions, structure, and conventions for SampleByte. Read this before contributing code.

---

## Stack

### What we use and why

| Layer | Choice | Rationale |
|---|---|---|
| Desktop runtime | **Electron** | Heavy native ops (ffmpeg, SQLite, file dialogs) are seamless via Node.js. Tauri would add Rust complexity for no real benefit here. |
| UI framework | **React 19 + TypeScript** | Ecosystem, tooling, WaveSurfer.js integration |
| Build | **Vite + vite-plugin-electron** | Fast HMR, clean ESM output |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Utility-first + headless accessible components |
| State | **Zustand** | Minimal boilerplate, no context prop drilling, TypeScript-native |
| Database | **better-sqlite3** | Synchronous SQLite — right for a desktop library with thousands of local files |
| Waveform | **WaveSurfer.js** | Best-in-class browser waveform with regions plugin |
| Audio processing | **fluent-ffmpeg** | Trim, convert, resample via ffmpeg subprocess |
| Audio analysis | **Custom Web Audio API** | BPM detection (autocorrelation) and key detection (Krumhansl-Schmuckler profiles) — offline, no dependencies |
| Audio sources | Local files + **Freesound API** | Legal, high-quality, 650k+ Creative Commons sounds |

### What we removed and why

| Removed | Reason |
|---|---|
| `ytdl-core` | YouTube ToS violation + chronically unreliable as YouTube updates its platform |
| Raw `useState` for global state | Prop drilling, listener leaks, no single source of truth |
| `ipcMain.on` / `event.sender.send` IPC pattern | Fire-and-forget with manual listener management, zero type safety |
| Flat JSON file storage | Cannot support search, filtering, or a library of thousands of files |

---

## Application Views

The app has three views, each covering a stage of the workflow:

```
┌──────────────────────────────────────────────┐
│   [ Chop ]    [ Library ]    [ Packs ]       │
├──────────────────────────────────────────────┤
│                                              │
│  Chop     Load audio → draw regions →        │
│           name chops → save to library       │
│                                              │
│  Library  Browse all saved samples →         │
│           search by BPM / key / tag →        │
│           preview on click                   │
│                                              │
│  Packs    Drag samples onto 4×4 pad grid →   │
│           pick hardware profile →            │
│           export ready-to-load folder        │
│                                              │
└──────────────────────────────────────────────┘
```

View state is managed by a Zustand store (no router needed for three views).

---

## IPC Architecture

### Pattern: invoke / handle

`ipcRenderer.invoke` returns a Promise. `ipcMain.handle` returns the response. It's request-response, just like `fetch`.

```typescript
// renderer — clean, typed, awaitable
const samples = await window.api.library.getSamples({ bpm: 120 })

// preload — one definition per operation
getSamples: (filters?) => ipcRenderer.invoke('library:getSamples', filters),

// main — one handler per operation, errors propagate naturally
ipcMain.handle('library:getSamples', (_, filters) => {
  return db.queries.samples.getAll(filters)
})
```

Errors thrown in a `handle` handler are serialised and re-thrown in the renderer's `invoke` Promise — no separate error channels needed.

The full API surface is defined in `electron/preload/index.ts` and typed in `src/types/global.d.ts`.

### Channel naming convention

`domain:operation` — e.g. `library:getSamples`, `audio:exportRegions`, `fs:pickFolder`.

---

## Database Schema

The library is backed by SQLite via `better-sqlite3`. The database file lives in Electron's `app.getPath('userData')`. Four tables: `samples`, `packs`, `pack_slots`, and `projects`. Schema and migrations are in `electron/main/db/index.ts`.

---

## State Management

Seven Zustand stores, each owning one domain: `player`, `library`, `packs`, `projects`, `freesound`, `ui`, and `toast`. Stores call `window.api.*` directly — no intermediate service layer. Components call store actions.

---

## Hardware Profiles

Each profile is a plain config object in `electron/main/hardware/profiles.ts`. Adding a new hardware target requires no code changes beyond adding one entry to the array. Each profile specifies container format, sample rate, bit depth, and a `fileName` function for pad naming conventions.

---

## Audio Export Pipeline

When the user exports a pack:

```
Packs view
  → window.api.packs.export(packId, outputDir)
  → IPC: 'packs:export'
  → main/services/export.ts
      1. Load pack + slots from DB
      2. Resolve hardware profile
      3. For each slot:
           ffmpeg trim source file to [start, end]
           resample to profile.format.sampleRate
           convert bit depth to profile.format.bitDepth
           write to outputDir/profile.fileName(slot, name)
  → returns { success: true, filesWritten: number }
```

ffmpeg runs as a child process via `fluent-ffmpeg`. Each trim is a separate ffmpeg call. For 16 pads this is fast enough to run sequentially without a progress bar, but we can add one later.

---

## Audio Analysis

BPM and key detection run in the renderer using the Web Audio API and custom signal-processing algorithms in `src/lib/audioAnalysis.ts`. No server, no internet, no WASM dependencies.

- **BPM** — autocorrelation on a downsampled RMS energy envelope
- **Key** — Krumhansl-Schmuckler pitch-class profiles compared against all 24 major/minor keys
- **Transient detection** — adaptive threshold on onset strength with configurable sensitivity (coarse / medium / fine), used for auto-chop

Analysis runs once when audio is loaded into the Chop view. Results are stored on the sample record when saved to the library.

---

## Freesound Integration

Freesound has a public REST API with Creative Commons licensed audio. The API key is stored in the main process (never exposed to the renderer) and all requests are proxied through the `freesound:*` IPC handlers in `electron/main/ipc/freesound.ts`. Downloaded files are added to the library automatically.

---

## Conventions

- **No comments explaining what code does.** Names should do that. Comments only for non-obvious _why_ — a constraint, a workaround, a subtle invariant.
- **IPC handlers throw on error.** The invoke/handle pattern propagates errors as rejections. No separate error channels.
- **Stores own async.** Components call store actions, not `window.api` directly.
- **Hardware profiles are data, not code.** A new device is a new object in the array, nothing else.
- **Waveform peaks are pre-computed.** When a sample is added to the library, its waveform data is computed once and stored in the DB. The Library view renders instantly without re-reading audio files.
