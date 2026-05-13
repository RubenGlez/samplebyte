# Architecture

This document covers the technical decisions, structure, and conventions for SampleByte. Read this before contributing code.

---

## Stack

### What we use and why

| Layer | Choice | Rationale |
|---|---|---|
| Desktop runtime | **Electron** | Heavy native ops (ffmpeg, SQLite, file dialogs) are seamless via Node.js. Tauri would add Rust complexity for no real benefit here. |
| UI framework | **React 18 + TypeScript** | Ecosystem, tooling, WaveSurfer.js integration |
| Build | **Vite + vite-plugin-electron** | Fast HMR, clean ESM output |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Utility-first + headless accessible components |
| State | **Zustand** | Minimal boilerplate, no context prop drilling, TypeScript-native |
| Database | **better-sqlite3** | Synchronous SQLite — right for a desktop library with thousands of local files |
| Waveform | **WaveSurfer.js** | Best-in-class browser waveform with regions plugin |
| Audio processing | **fluent-ffmpeg** | Trim, convert, resample via ffmpeg subprocess |
| Audio analysis | **essentia.js** (WASM) | BPM and key detection running in the renderer, offline, no server needed |
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

## Folder Structure

```
samplebyte/
├── docs/
│   ├── ARCHITECTURE.md         ← you are here
│   └── ROADMAP.md
│
├── electron/
│   ├── main/
│   │   ├── index.ts            # app bootstrap, BrowserWindow creation
│   │   ├── db/
│   │   │   ├── index.ts        # better-sqlite3 init + migrations
│   │   │   └── queries/
│   │   │       ├── samples.ts  # sample CRUD
│   │   │       ├── packs.ts    # pack + pack_slots CRUD
│   │   │       └── projects.ts # project CRUD
│   │   ├── ipc/
│   │   │   ├── audio.ts        # audio:export, audio:peaks
│   │   │   ├── library.ts      # library:getSamples, addSample, etc.
│   │   │   ├── filesystem.ts   # fs:pickFile, fs:pickFolder
│   │   │   ├── freesound.ts    # freesound:search, freesound:download
│   │   │   └── packs.ts        # packs:create, packs:export
│   │   ├── hardware/
│   │   │   └── profiles.ts     # hardware export profile definitions
│   │   └── services/
│   │       └── export.ts       # ffmpeg orchestration per hardware profile
│   └── preload/
│       └── index.ts            # typed contextBridge
│
└── src/
    ├── stores/
    │   ├── player.ts           # current audio, regions, playback state
    │   ├── library.ts          # sample list, search query, filters
    │   └── packs.ts            # current pack being built, hardware profile
    ├── views/
    │   ├── Chop/
    │   │   ├── index.tsx
    │   │   ├── WaveformEditor.tsx
    │   │   ├── RegionList.tsx
    │   │   └── SourcePicker.tsx    # drag file or search Freesound
    │   ├── Library/
    │   │   ├── index.tsx
    │   │   ├── SampleGrid.tsx
    │   │   ├── SampleCard.tsx
    │   │   └── Filters.tsx
    │   └── Packs/
    │       ├── index.tsx
    │       ├── PadGrid.tsx         # 4×4 visual pad layout
    │       ├── PadSlot.tsx
    │       └── ExportDialog.tsx
    ├── components/                 # shared UI primitives (shadcn/ui based)
    │   ├── Button.tsx
    │   ├── Dialog.tsx
    │   ├── Input.tsx
    │   └── Tag.tsx
    ├── hooks/
    │   ├── useWavesurfer.ts
    │   ├── useRegions.ts
    │   ├── useKeyboard.ts
    │   ├── useZoom.ts
    │   └── useAnalysis.ts          # essentia.js BPM + key detection
    └── lib/
        ├── ipc.ts                  # typed invoke wrappers (thin client layer)
        ├── freesound.ts            # Freesound API client
        └── format.ts               # audio format utilities
```

---

## IPC Architecture

### The problem with the old pattern

The original code used `ipcMain.on` + `event.sender.send` — a fire-and-forget event bus:

```typescript
// renderer sends and hopes for a callback event
window.api.send("saveProject", data)
window.api.receive("saveProjectSuccess", handler)  // leaks if called twice
window.api.receive("saveProjectError", handler)    // no type safety
```

Every operation required registering handlers in four places. The `removeAllListeners` hack in the preload masked listener accumulation bugs. There was no way to type the channel names or payloads.

### The new pattern: invoke / handle

`ipcRenderer.invoke` returns a Promise. `ipcMain.handle` returns the response. It's request-response, just like `fetch`.

```typescript
// renderer — clean, typed, awaitable
const samples = await window.api.library.getSamples({ bpm: 120 })

// preload — one definition per operation
contextBridge.exposeInMainWorld('api', {
  library: {
    getSamples:   (filters?) => ipcRenderer.invoke('library:getSamples', filters),
    addSample:    (path)     => ipcRenderer.invoke('library:addSample', path),
    updateSample: (id, data) => ipcRenderer.invoke('library:updateSample', id, data),
    deleteSample: (id)       => ipcRenderer.invoke('library:deleteSample', id),
  },
  audio: {
    exportRegions:   (params) => ipcRenderer.invoke('audio:exportRegions', params),
    getWaveformData: (path)   => ipcRenderer.invoke('audio:getWaveformData', path),
  },
  fs: {
    pickFile:   () => ipcRenderer.invoke('fs:pickFile'),
    pickFolder: () => ipcRenderer.invoke('fs:pickFolder'),
  },
  freesound: {
    search:   (query, page?) => ipcRenderer.invoke('freesound:search', query, page),
    download: (id, destDir)  => ipcRenderer.invoke('freesound:download', id, destDir),
  },
  packs: {
    getAll:  ()                  => ipcRenderer.invoke('packs:getAll'),
    create:  (data)              => ipcRenderer.invoke('packs:create', data),
    export:  (packId, outputDir) => ipcRenderer.invoke('packs:export', packId, outputDir),
  },
})

// main — one handler per operation, errors propagate naturally
ipcMain.handle('library:getSamples', (_, filters) => {
  return db.queries.samples.getAll(filters)
})
```

Errors thrown in a `handle` handler are serialised and re-thrown in the renderer's `invoke` Promise — no separate error channels needed.

### Channel naming convention

`domain:operation` — e.g. `library:getSamples`, `audio:exportRegions`, `fs:pickFolder`.

---

## Database Schema

The library is backed by SQLite via `better-sqlite3`. The database file lives in Electron's `app.getPath('userData')`.

```sql
-- Every chop or imported file
CREATE TABLE samples (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  file_path     TEXT    UNIQUE NOT NULL,  -- absolute path on disk
  duration      REAL,                    -- seconds
  bpm           REAL,
  musical_key   TEXT,                    -- e.g. "C minor"
  tags          TEXT,                    -- JSON array: ["drums","loop","124bpm"]
  source        TEXT,                    -- 'local' | 'freesound'
  freesound_id  TEXT,
  waveform_data TEXT,                    -- JSON peaks, pre-computed for fast render
  created_at    INTEGER                  -- unix timestamp
);

-- A named collection of samples assigned to pad slots
CREATE TABLE packs (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  hardware_profile TEXT NOT NULL,        -- matches HardwareProfile.id
  created_at       INTEGER
);

-- Which sample occupies which pad in a pack
CREATE TABLE pack_slots (
  pack_id     TEXT    NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,          -- 0–15 (maps to physical pads)
  sample_id   TEXT    NOT NULL REFERENCES samples(id),
  PRIMARY KEY (pack_id, slot_number)
);

-- A saved chopping session (source file + region timestamps)
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  source_path TEXT,
  regions     TEXT,                      -- JSON: [{start, end, name}, ...]
  created_at  INTEGER
);
```

---

## State Management

Three Zustand stores. Each store owns one domain.

```
stores/player.ts
  currentAudio: { path, name, duration } | null
  wavesurfer: WaveSurfer | null          -- ref, not reactive
  regions: Region[]
  selectedRegion: Region | null
  isPlaying: boolean

stores/library.ts
  samples: Sample[]
  searchQuery: string
  filters: { bpm?: number, key?: string, tags?: string[] }
  selectedSample: Sample | null

stores/packs.ts
  currentPack: Pack | null
  slots: Record<number, Sample>          -- slot index → sample
  hardwareProfile: HardwareProfile
  exportProgress: number | null
```

Stores call `window.api.*` directly — no intermediate service layer. Components call store actions.

---

## Hardware Profiles

Each profile is a plain config object. Adding a new hardware target requires no code changes beyond adding an entry to the profiles array.

```typescript
type HardwareProfile = {
  id: string
  name: string
  padCount: number
  format: {
    container: 'wav' | 'aiff'
    sampleRate: 44100 | 48000 | 96000
    bitDepth: 16 | 24 | 32
  }
  fileName: (slot: number, sampleName: string) => string
}

const profiles: HardwareProfile[] = [
  {
    id: 'maschine-mk3',
    name: 'Maschine MK3',
    padCount: 16,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 16 },
    fileName: (slot, name) => `${String(slot + 1).padStart(2, '0')}_${name}.wav`,
  },
  {
    id: 'sp404-mkii',
    name: 'Roland SP-404 MkII',
    padCount: 16,
    format: { container: 'wav', sampleRate: 48000, bitDepth: 16 },
    fileName: (slot, name) => `${String(slot + 1).padStart(3, '0')}_${name}.wav`,
  },
  {
    id: 'mpc-generic',
    name: 'Akai MPC',
    padCount: 16,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 24 },
    fileName: (slot, name) => `${name}.wav`,
  },
  {
    id: 'generic',
    name: 'Generic WAV',
    padCount: 128,
    format: { container: 'wav', sampleRate: 44100, bitDepth: 24 },
    fileName: (_, name) => `${name}.wav`,
  },
]
```

---

## Audio Export Pipeline

When the user exports a pack, the flow is:

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

ffmpeg runs as a child process via `fluent-ffmpeg`. Each trim is a separate ffmpeg call. For 16 pads, this is fast enough to run sequentially without a progress bar, but we can add one later.

---

## Audio Analysis

BPM and key detection runs in the renderer via `essentia.js` (compiled to WASM). No server, no internet required.

```typescript
// hooks/useAnalysis.ts
const { bpm, key } = useAnalysis(audioBuffer)
```

Analysis runs once when audio is loaded into the Chop view. Results are stored in the sample record when saved to the library.

---

## Freesound Integration

Freesound has a public REST API with Creative Commons licensed audio. The API key is stored in the main process (never exposed to the renderer) and all requests are proxied through the `freesound:*` IPC handlers.

The client in `src/lib/freesound.ts` provides typed wrappers:

```typescript
freesound.search(query, { page, pageSize, filter })
// → { results: FreesoundResult[], count: number, next: string | null }

freesound.download(id, destDir)
// → { filePath: string }  — file saved to userData/freesound-cache/
```

Downloaded files are added to the library automatically.

---

## Conventions

- **No comments explaining what code does.** Names should do that. Comments only for non-obvious _why_ — a constraint, a workaround, a subtle invariant.
- **IPC handlers throw on error.** The invoke/handle pattern propagates errors as rejections. No separate error channels.
- **Stores own async.** Components call store actions, not `window.api` directly.
- **Hardware profiles are data, not code.** A new device is a new object in the array, nothing else.
- **Waveform peaks are pre-computed.** When a sample is added to the library, its waveform data is computed once and stored in the DB. The Library view renders instantly without re-reading audio files.
