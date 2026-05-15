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
│   │   ├── update.ts           # electron-updater auto-update logic
│   │   ├── db/
│   │   │   ├── index.ts        # better-sqlite3 init + migrations
│   │   │   └── queries/
│   │   │       ├── samples.ts  # sample CRUD
│   │   │       ├── packs.ts    # pack + pack_slots CRUD
│   │   │       └── projects.ts # project CRUD
│   │   ├── hardware/
│   │   │   └── profiles.ts     # hardware export profile definitions
│   │   └── ipc/
│   │       ├── audio.ts        # audio:exportRegions
│   │       ├── filesystem.ts   # fs:pickFile, fs:pickFolder
│   │       ├── freesound.ts    # freesound:search, freesound:download
│   │       ├── library.ts      # library:getSamples, saveChops, etc.
│   │       ├── packs.ts        # packs:create, upsertSlot, export, etc.
│   │       └── settings.ts     # settings:get, settings:set
│   └── preload/
│       └── index.ts            # typed contextBridge
│
└── src/
    ├── views/
    │   ├── Chop/index.tsx      # waveform editor, region creation, save to library
    │   ├── Library/index.tsx   # sample grid, search, filters, preview
    │   └── Packs/index.tsx     # 4×4 pad grid, hardware profile picker, export
    ├── components/             # shared UI components
    │   ├── AudioWaveform.tsx   # WaveSurfer wrapper + region controls
    │   ├── Loader.tsx          # source picker (local file + Freesound search)
    │   ├── SampleList.tsx      # region list with editable names
    │   ├── FilterControls.tsx  # library search and tag filters
    │   ├── Card/               # generic card primitives
    │   └── ui/                 # headless primitives (Button, Dialog, Input, Toaster)
    ├── hooks/
    │   ├── useWaveSurfer.ts    # WaveSurfer instance lifecycle
    │   ├── useRegions.ts       # region CRUD on the waveform
    │   ├── useAudioAnalysis.ts # BPM + key detection via Web Audio API
    │   ├── useAudioPlayer.ts   # simple play/pause for library preview
    │   ├── useFilteredSamples.ts
    │   ├── useInlineRename.ts
    │   ├── useShortcuts.ts
    │   └── useZoom.ts
    ├── stores/
    │   ├── player.ts           # current audio, regions, playback state
    │   ├── library.ts          # sample list, search query, tag filters
    │   ├── packs.ts            # current pack, pad slots, hardware profile
    │   ├── projects.ts         # saved chop sessions
    │   ├── freesound.ts        # Freesound search state and API key
    │   ├── ui.ts               # active view, sidebar state
    │   └── toast.ts            # ephemeral notifications
    ├── lib/
    │   ├── audioAnalysis.ts    # BPM (autocorrelation) + key (K-S profiles) algorithms
    │   └── utils.ts            # cn(), shared utilities
    └── types/
        ├── global.d.ts         # window.api type declarations
        └── index.ts            # shared frontend types
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
    getSamples:   (filters?)    => ipcRenderer.invoke('library:getSamples', filters),
    addSample:    (data)        => ipcRenderer.invoke('library:addSample', data),
    updateSample: (id, data)    => ipcRenderer.invoke('library:updateSample', id, data),
    deleteSample: (id)          => ipcRenderer.invoke('library:deleteSample', id),
    saveChops:    (params)      => ipcRenderer.invoke('library:saveChops', params),
  },
  projects: {
    getAll:    ()           => ipcRenderer.invoke('projects:getAll'),
    get:       (id)         => ipcRenderer.invoke('projects:get', id),
    save:      (data)       => ipcRenderer.invoke('projects:save', data),
    update:    (id, data)   => ipcRenderer.invoke('projects:update', id, data),
    delete:    (id)         => ipcRenderer.invoke('projects:delete', id),
    duplicate: (id)         => ipcRenderer.invoke('projects:duplicate', id),
  },
  audio: {
    exportRegions: (params) => ipcRenderer.invoke('audio:exportRegions', params),
  },
  fs: {
    pickFile:   () => ipcRenderer.invoke('fs:pickFile'),
    pickFolder: () => ipcRenderer.invoke('fs:pickFolder'),
  },
  settings: {
    get: (key)        => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },
  freesound: {
    search:   (query, page?)               => ipcRenderer.invoke('freesound:search', query, page),
    download: (soundId, name, previewUrl)  => ipcRenderer.invoke('freesound:download', soundId, name, previewUrl),
  },
  packs: {
    getAll:      ()                        => ipcRenderer.invoke('packs:getAll'),
    getSlots:    (packId)                  => ipcRenderer.invoke('packs:getSlots', packId),
    getProfiles: ()                        => ipcRenderer.invoke('packs:getProfiles'),
    create:      (data)                    => ipcRenderer.invoke('packs:create', data),
    upsertSlot:  (packId, slot, sampleId) => ipcRenderer.invoke('packs:upsertSlot', packId, slot, sampleId),
    removeSlot:  (packId, slot)           => ipcRenderer.invoke('packs:removeSlot', packId, slot),
    rename:      (id, name)               => ipcRenderer.invoke('packs:rename', id, name),
    delete:      (id)                     => ipcRenderer.invoke('packs:delete', id),
    export:      (packId, outputDir)      => ipcRenderer.invoke('packs:export', packId, outputDir),
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

BPM and key detection run in the renderer using the Web Audio API and custom signal-processing algorithms implemented in `src/lib/audioAnalysis.ts`. No server, no internet, no WASM dependencies.

- **BPM** — autocorrelation on a downsampled RMS energy envelope
- **Key** — Krumhansl-Schmuckler pitch-class profiles compared against all 24 major/minor keys
- **Transient detection** — adaptive threshold on onset strength with configurable sensitivity (coarse / medium / fine), used for auto-chop

```typescript
// hooks/useAudioAnalysis.ts
const { bpm, musicalKey } = useAudioAnalysis(audioUrl)
```

Analysis runs once when audio is loaded into the Chop view. Results are stored on the sample record when saved to the library.

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
