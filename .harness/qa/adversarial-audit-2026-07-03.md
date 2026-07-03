# SampleByte — Adversarial Codebase Audit (2026-07-03)

Auditor: senior-staff-engineer pass over the full repository (every source file under
`electron/`, `src/`, `scripts/`, `test/`, `.github/`, plus configs and docs). No loyalty to the
current design. Findings are marked **CONFIRMED** (traced end-to-end in code, or provable from
tool semantics) or **PLAUSIBLE** (strong reasoning, needs a live run to prove — this environment
has no node_modules/ffmpeg/display, and the `.harness/` ADRs are age-encrypted, so ADR references
below are by title only).

---

## 1. System map

### Processes and boundaries

- **Main process** (`electron/main/index.ts`): window + splash, custom `local-file://` protocol
  (CORS-open file server for the renderer), production CSP injection, DB init
  (`electron/main/db/index.ts`, better-sqlite3, WAL, migrations run inline at startup), one-time
  chop materialization pass, then registration of all IPC handlers. Security posture is good at
  the window level: `contextIsolation: true`, `nodeIntegration: false`, window-open handler only
  allows `https:` via `shell.openExternal`, single-instance lock.
- **Preload** (`electron/preload/index.ts`): exposes a typed `window.api` bridge. The
  contract (`electron/ipc-contract.ts`) is genuinely a single source of truth for
  preload/main/renderer signatures — a strong point. It does **not** validate values, only types
  at compile time; at runtime every channel trusts renderer-supplied paths, hashes, and numbers.
- **Renderer** (`src/`): React 19 + Zustand stores (`projects`, `library`, `packs`, `player`,
  `stems`, `freesound`, `ui`, `toast`), three views (Chop / Library / Packs), WaveSurfer for the
  chop editor, a DSP worker pool for BPM/key/transient/loop analysis, and a demucs WASM worker
  for stem separation (loaded via `(0, eval)(jsText)` — the reason for the `'unsafe-eval'` CSP).

### Real execution paths (traced)

1. **Open → chop → autosave**: `Loader` sets `player.audio` → `AudioWaveform` mounts (keyed by
   URL) → `useRegions` drives the WaveSurfer regions plugin → every region change bumps
   `revision` → `useChopAutosave` debounces (1.5 s, max-wait 5 s) →
   `projects.autosaveActiveRegions` → first save `projects:save` (creates project + chops, then
   `syncProjectChopsToLibrary` renders **every chop through ffmpeg** before the IPC promise
   resolves); later saves `projects:upsertChops` + the same sync. The library is a projection:
   each chop becomes a real WAV under `userData/samples/` with `source='chop'` and
   `source_chop_id` provenance.
2. **Trim**: `audio:trimSource` → `trimSourceToCache` renders a new WAV under `userData/sources/`
   → renderer remaps regions to the new 0-based timeline (`remapRegionsForTrim`, dropping region
   ids) → autosave persists → `setAudio` remounts the editor on the trimmed file.
3. **Pack**: drag a library sample onto a pad → `packs:upsertSlot` → `materializeSlotAudio`
   renders a pad-owned WAV under `userData/pack-slots/` (fallback: null owned path, export trims
   from source). Export: `packs:export` → `exportClips` renders every slot **in parallel** to the
   picked folder using the hardware profile's format + filename convention.
4. **Freesound**: `freesound:search` (key read from `settings.json` per call) →
   `freesound:download` fetches the **HQ preview MP3** (not the original) into
   `userData/staging/<uuid>.mp3` → loaded straight into the chop editor.
5. **Stems**: renderer fetches source bytes, SHA-256 hash → `stems:getCached` → else load
   model bytes over IPC, eval in worker, separate, `stems:persist` writes 4 WAVs under
   `userData/stems/<hash>/` through the shared render funnel.
6. **Startup**: `materializeProjectChops()` is awaited **before** `createWindow()` — a one-time
   backfill that runs one ffmpeg render per legacy chop.

### Key invariants (as designed, per ADR titles + code comments)

- Chops autosave; there is no explicit save (ADR-0004).
- The library is a materialized, live projection of project chops (ADR-0006); removing a chop
  removes its library sample; packs are **not** touched by that.
- Packs are independent snapshots: pads own their trimmed audio (`audio_path`), so export must
  never depend on the source chop/sample/file still existing (ADR-0003).
- Pad audition is preview-only (ADR-0005).

Where those invariants are enforced vs. assumed is the core of the findings below: most are
enforced only by the happy-path call sequence, not by the data layer, and several break under
concurrency or deletion.

---

## 2. Findings

Severity scale: **P0** data loss / broken headline feature · **P1** correctness or UX failure
users will hit · **P2** debt, drift, leaks · **P3** minor.

### 2.1 Correctness

**F1 · P0 · Deleting a library sample deletes the user's original file on disk.**
`electron/main/ipc/library.ts:51-56` — `library:deleteSample` unconditionally
`fs.unlinkSync(filePath)` after removing the row. `library:importFolder` (`library.ts:40-49`)
registers files **in place** — `filePath` is the user's own file in their own folder; nothing is
copied into app storage. Scenario: user imports `~/Music/Breaks/` (500 files), later prunes a few
rows from the Library ("This sample will be permanently deleted from your library", says the
dialog — `src/views/Library/index.tsx:280-282`) → their original files are destroyed. The same
unlink also hits stems-cache WAVs added via "Save stem to Library"
(`AudioWaveform.tsx:516-528` stores `filePath` pointing into `userData/stems/<hash>/`), silently
corrupting the stem cache contract that `getCachedStems` checks (all-4-present → now 3).
**CONFIRMED.** Direction: track file ownership per row (`owned: bool`, true only for files the
app rendered/downloaded into userData) and only unlink owned files; or copy-on-import.

**F2 · P0 · 24-bit export profiles pass an invalid ffmpeg sample format — MPC and Generic WAV
exports fail.** `electron/main/hardware/profiles.ts:26,40` set `sampleFmt: 's24'`;
`electron/main/services/render.ts:41` passes it as `-sample_fmt s24`. ffmpeg has **no `s24`
sample format** (valid: `u8 s16 s32 flt dbl s64` + planar); `-sample_fmt` with an unparseable
value is a fatal option error, so every clip render for `mpc-generic` and `generic` rejects.
Combined with F7 (silent export failure) the user clicks Export on an MPC pack and gets an empty
folder with no error. The test suite (`render.test.ts`) only ever exercises `s16`, so CI cannot
catch this; the README advertises both profiles as supported hardware. **CONFIRMED** by ffmpeg
semantics (unrunnable in this sandbox — flagging honestly: if fluent-ffmpeg or a future ffmpeg
build aliased `s24`, this would downgrade, but no released ffmpeg does). Direction: use
`-c:a pcm_s24le` for 24-bit WAV (drop `-sample_fmt`), and add a render test per profile format.

**F3 · P1 · Autosave race creates duplicate projects.**
`src/hooks/useChopAutosave.ts:52-71` + `src/stores/projects.ts:75-91` +
`electron/main/ipc/library.ts:95-99`. The first save is slow by design: `projects:save` awaits
`syncProjectChopsToLibrary`, i.e. one ffmpeg render per chop, before resolving. Meanwhile
`lastSavedAt` is still 0, so the next region edit computes `elapsed >= MAX_WAIT_MS` → fires a
second `autosaveActiveRegions` with **delay 0**; `activeProject` is still null (set only when
save #1 resolves) → a second `projects:save` → two projects (and two full library
materializations) for one session. Scenario: drop a file, drag out 8 chops quickly — very likely
on any non-trivial file. **CONFIRMED** by trace. Direction: an in-flight guard/promise latch in
`autosaveActiveRegions` (create-once semantics keyed by sourcePath), or make `projects:save`
return before materialization.

**F4 · P1 · Concurrent library syncs double-materialize chops.**
`electron/main/services/materializeChops.ts:75-102` reads `existing` samples, then awaits ffmpeg
per chop before inserting. IPC handlers interleave on the main-process event loop, and three
renderer paths call sync-triggering channels independently (autosave `upsertChops`, Send-to-Pack's
own `autosaveActiveRegions`, trim's save): two overlapping syncs both see "no sample for chop X"
and both `addSample` → duplicate `source_chop_id` rows + duplicate WAVs. The dedup map
(`existingByChopId`, last-wins) never removes the extra row while the chop lives. **CONFIRMED**
by trace (no serialization anywhere in main). Direction: serialize per-project sync (simple
promise chain keyed by projectId) and/or a UNIQUE index on `samples(source_chop_id)`.

**F5 · P1 · Deleting the last chop — and "Clear all" — are never persisted.**
`src/hooks/useChopAutosave.ts:46`: `if (!filePath || !regions?.length) return` — a transition to
zero regions cancels the pending timer (effect cleanup) and schedules nothing. Scenario: user
deletes their only chop (or confirms the "Clear all chops?" dialog, `SampleList.tsx:60-75`),
quits, reopens → all chops are back, library samples included. The confirmation dialog promises
"This will remove all chops from this audio file". **CONFIRMED** by trace. Direction: allow the
empty-regions save (only skip when `regions === undefined`, i.e. plugin not ready).

**F6 · P1 · Export filename collisions silently overwrite pads.**
`profiles.ts:51-53` `sanitize()` maps to `[a-z0-9_-]` and lowercases; `mpc-generic` and `generic`
filenames are name-only (`profiles.ts:27,41`). Pads "Kick!" and "Kick?" → both `kick_.wav`;
`exportClips` (`export.ts:28-35`) renders all clips **in parallel to the same path** and reports
`filesWritten: clips.length`. User exports 16 pads, gets 14 files and a "16 files exported" toast.
Empty display names produce `.wav`. **CONFIRMED.** Direction: de-duplicate filenames (suffix
`_2`), always include the slot number, and count actual files written.

**F7 · P1 · Pack export / send-to-pack failures are swallowed — no error UI.**
`src/views/Packs/index.tsx:58-69` `handleExport` is `try { … } finally { … }` with **no catch**:
a rejected `exportClips` (missing legacy source file, F2, unwritable folder) resets the button
and surfaces nothing but an unhandled rejection in the console. Same pattern:
`handleSendToPack` (`AudioWaveform.tsx:235-271`), `regenerateSlot`/`updateSlotFromSource`
(`Packs/index.tsx:153-175`), `handleImportFolder` (`AppSidebar.tsx:219-234`). Also
`exportClips`'s `Promise.all` aborts on first rejection while sibling renders keep writing —
partial exports are left in the output folder with no cleanup or report. **CONFIRMED.**
Direction: catch → toast in every user-triggered async action; per-clip `allSettled` with a
written/failed summary.

**F8 · P1 · Stems: concurrent/cancelled separations hang or cross wires.**
`src/stores/stems.ts:41-51,148-153,195-199`: `pendingResult` and `onProgress` are module-level
singletons. A second `separate()` while one is in flight (select stem → restore → run again, or
switch source fast) clobbers `pendingResult` — the first `await` never settles (leaked promise,
status machine now lies). `cancel()` terminates the worker but never rejects `pendingResult`, so
the in-flight `separate()` also hangs forever at `stems.ts:148`; only the `set({status:'idle'})`
masks it. There is also no input-length guard: a 10-minute track is ~2×53 MB in, 8×53 MB out,
plus an 85 MB model in a 32-bit-heap Emscripten build — an OOM/abort path with no message.
**CONFIRMED** (hang paths traced); OOM PLAUSIBLE. Direction: per-run token + reject-on-cancel,
disable Run while running, cap duration with a clear toast.

**F9 · P2 · `renderLibrarySample` records the *requested* duration, not the real one.**
`materializeChops.ts:34` returns `duration: end - start`. A chop whose end overshoots the decoded
source (drag to the edge, ffmpeg mp3 duration jitter) yields a shorter file with a longer claimed
duration — Library shows it, pad grid shows it, and pad audition's region-stop logic
(`useAudioPlayer.ts:25-31`) waits for a timestamp that never arrives. **CONFIRMED** (mismatch),
impact minor. Direction: probe the output (the WAV header is already being read for the waveform).

**F10 · P2 · `extractWaveformData` mis-parses non-canonical WAVs.**
`electron/main/audio/waveform.ts:8-14`: the chunk walk ignores odd-size chunk padding (the test
helper `test/wav.ts:33` gets this right — two divergent WAV parsers in one repo), and if no
`data` chunk is found it silently treats trailing garbage as samples. Fine for ffmpeg-produced
files today; wrong the day someone points it at an arbitrary WAV (e.g.
`packs:regenerateSlotToLibrary` runs it on any `audioPath`). **CONFIRMED** (logic), low impact.

**F11 · P2 · Freesound store swallows offline/API errors.** `src/stores/freesound.ts:43-82` —
`search`/`loadMore` let rejections escape `withLoading`; callers (`Loader.tsx:224-232`,
`setSort`, `setDurationFilter`) never catch. Offline or 401 (bad key) → spinner stops, empty
results, zero feedback. **CONFIRMED.** Direction: catch → toast, and detect 401 → "check your
API key".

**F12 · P2 · `useChopAutosave` failure path lies.** `useChopAutosave.ts:70` —
`.catch(() => setSaveStatus('idle'))`: a failed save (DB error, ffmpeg missing) shows the same
idle state as success; edits are silently unsaved. The header can even show "Saved" from a prior
run. **CONFIRMED.** Direction: `saveStatus: 'error'` + retry.

**F13 · P2 · Pad audition plays the live source, not the pad's snapshot.**
`Packs/index.tsx:508-510` — `useAudioPlayer(toLocalFileUrl(slot.sourcePath), region)`. The pad
*owns* `audio_path` precisely so it survives source deletion, but preview reads the original
file: delete/move the source and the pad still exports fine yet auditions as silence (and the
region-bounds stop uses `ontimeupdate`, overshooting by up to ~250 ms). ADR-0005's
"preview-only" promise is kept; the snapshot promise is not. **CONFIRMED.** Direction: prefer
`slot.audioPath` for audition.

### 2.2 Alternative / unintended paths

**F14 · P1 · Startup is blocked by the materialization backfill.**
`electron/main/index.ts:249-260` awaits `materializeProjectChops()` **before** `createWindow()`.
The comment says it "runs off the sync migration path", but it still gates the first window: a
user upgrading with 300 legacy chops waits for 300 sequential ffmpeg renders staring at nothing
(the splash is created in `createWindow`, which hasn't run). A missing source makes each chop
retry **on every launch** forever (catch-and-skip, `materializeChops.ts:63-66`). **CONFIRMED.**
Direction: create the window first, run the backfill after `ready-to-show`, and record permanent
failures.

**F15 · P2 · Second-call / crash edges in slot upsert.** `packs.ts:47-55`: two rapid
`upsertSlot`s for the same pad both read `previous`, both materialize; the loser's freshly
rendered WAV is orphaned on disk forever (nothing references it, nothing deletes it). A crash
between `materializeSlotAudio` and the DB write leaks the same way. **CONFIRMED** (unbounded but
slow leak). Direction: write-then-diff inside a transaction, or a startup sweep of
`pack-slots/` against `pack_slots.audio_path`.

**F16 · P2 · `library:importFolder` blocks the main process and dedups only by exact path.**
`library.ts:8-22,40-49`: synchronous recursive scan + N synchronous inserts on the UI/event-loop
thread — a big NAS folder freezes every window and all IPC. Re-importing the same file from a
renamed/moved folder duplicates rows (dedup is `Set` of exact `file_path`). **CONFIRMED.**
Direction: async scan, chunked inserts, content-hash or (dev,inode) dedup if desired.

**F17 · P2 · Corrupted/locked DB and missing ffmpeg have no user-facing story.** `initDatabase`
throws → caught only by the global `uncaughtException` dialog (good), but WAL + a second
half-alive instance, or a corrupt file, yields a raw better-sqlite3 message with no recovery
hint. Missing ffmpeg binary (unsupported arch — `optionalDependencies` pins only darwin/win32;
Linux resolves transitively, `package.json:82-86`) surfaces as per-render rejections that F7
then swallows entirely. **PLAUSIBLE** (not traced on a real broken install). Direction: probe
ffmpeg once at startup; preflight DB open with a "your library is damaged, backup at…" path.

### 2.3 Incoherences (names that lie, duplicated truth, dead code)

**F18 · P2 · The auto-update system is dead code — users never get updates.**
`electron/main/update.ts` registers `check-update` / `start-download` / `quit-and-install` and
sends `update-can-available` to the renderer, but the preload bridge exposes **none** of it
(`ipc-contract.ts` has no update surface) and with `contextIsolation` the renderer cannot invoke
those channels; nothing anywhere calls `checkForUpdates`. `electron-updater` ships in every build
(and `autoDownload=false` means even a stray check downloads nothing). Also `startDownload`
(`update.ts:68-76`) re-registers listeners per call — would multiply progress events if it were
ever wired. **CONFIRMED.** Direction: either expose it in the contract + UI, or delete the module
and the dependency; the current state quietly strands old versions (relevant given 0.0.x weekly
cadence).

**F19 · P2 · Duplicated sources of truth.** (a) Hardware profiles exist twice: main
(`hardware/profiles.ts`) and a hardcoded copy in the renderer (`Packs/index.tsx:27-32`) while
the purpose-built `packs:getProfiles` channel has **zero callers**; the two disagree with
README's table ("Akai MPC (generic)" vs UI "Akai MPC One"). (b) `padCount` exists per profile
(128 for generic) but the grid, `filledSlots/16` label, recovery scan, and Send-to-Pack's
`.slice(0, 16)` (`AudioWaveform.tsx:247`) all hardcode 16. (c) `projects.regions` JSON column is
still written on every save (`projects.ts:66-74,98-109`) with **two different shapes**
(save omits `updatedAt`, update includes it) but is never read — `deserialize` reads
`project_chops`. (d) `bitDepth` in profile formats is dead; only `sampleFmt` matters (see F2).
(e) `pack_slots.pitch_shift_semitones` / `time_stretch_ratio` are created, migrated, seeded, and
always NULL — a feature that exists only in the schema. **CONFIRMED.**

**F20 · P3 · Dead code inventory.** `src/components/Nav.tsx` and `Card/CardRoot.tsx` (no
importers), `audio:exportRegions` channel + `exportClips` region path (no renderer caller —
the "export chops directly" feature is gone but its IPC and types remain), `library:saveChops` +
`useLibraryStore.saveChops` (no caller), `packs.exportProgress` (never set — promises progress
that doesn't exist), `detectTransientsFromUrl` (worker `transients` kind unreachable from UI),
`convertBlobUrlToArrayBuffer`, `useShortcuts`'s empty Tab/Escape handlers. **CONFIRMED.**
Direction: delete; every dead channel is attack/maintenance surface.

**F21 · P2 · "staging", "sources", "cache" are permanent directories pretending to be
temporary.** Freesound downloads land in `userData/staging/` and become the **canonical
long-term source** of any project chopped from them; `trimSourceToCache` (`trim.ts:7-18`) says
"cached" but every trim mints a new UUID WAV that is never reused nor deleted, and the old
trimmed source of a re-trimmed project is orphaned. Nothing ever cleans `staging/`, `sources/`,
`stems/`, or orphaned `pack-slots/` audio (F15) — and `deleteSample` (`samples.ts:126-132`)
deletes pack_slot **rows** without unlinking their `audio_path` files. Unbounded disk growth
with misleading names. **CONFIRMED.** Direction: rename honestly, add a startup GC that sweeps
files unreferenced by any project/sample/slot row.

**F22 · P2 · Deletion semantics contradict the snapshot ADR.** `samples.deleteSample`
(`samples.ts:126-132`) removes `pack_slots` rows referencing the sample — the pad dies even
though it owns its audio (`audio_path` would keep export working) — while
`deleteChopSampleRow` (`samples.ts:153-158`) deliberately leaves slots alive for the same
situation, and `packs:regenerateSlotToLibrary` exists precisely to resurrect orphaned pads. The
UI warns ("Deleting it will remove those slots permanently"), so users aren't ambushed, but the
data layer implements two opposite philosophies for the same event. Note the migrated
`pack_slots` table has **no FK on sample_id** (`db/index.ts:164-216` recreates it without
REFERENCES), so keeping the slots is entirely feasible. **CONFIRMED.** Direction: pick one —
orphan the pad into the existing recovery flow instead of deleting it.

**F23 · P3 · Misc incoherences.** `if (release().startsWith('6.1')) app.disableHardwareAcceleration()`
(`main/index.ts:99`) targets Windows 7 but also matches Linux kernel 6.1.x LTS.
`electron-builder.json5` declares Linux targets that no workflow builds and the README doesn't
mention. `handle('shell:openExternal', …)` is registered inline in `main/index.ts:245` instead of
an `ipc/` module. Seed slots are **1-based** while the pad grid is 0-based
(`seed.sh:156-167` vs `Packs/index.tsx:309-313`) — seeded pads render shifted one pad down, and a
seeded slot 16 would be invisible. **CONFIRMED.**

### 2.4 Affordance mismatches

**F24 · P1 · Freesound "Import to Library" neither imports to the library nor downloads the
sound.** The download button's tooltip is "Import to Library" (`Loader.tsx:400`), but
`handleDownload` only stages a file and opens it in Chop — nothing is added to the library unless
chops are later made. And `freesound:download` (`freesound.ts:36-44`) fetches
`previews['preview-hq-mp3']` — a lossy ~128 kbps **preview**, not the original file (originals
need OAuth2) — while the README sells "search 650,000+ Creative Commons sounds". No license or
attribution is stored anywhere (`FreesoundResult.license` is fetched, shown nowhere, persisted
nowhere) even though most CC licenses on Freesound require attribution; users exporting packs
have no way to comply. **CONFIRMED.** Direction: fix the tooltip, persist
license/author/freesound_id on the sample row, state the preview-quality limitation in UI+README.

**F25 · P2 · Send to Pack silently truncates and mislabels.** `AudioWaveform.tsx:246-268`
slices to 16 chops with no warning when there are more, always creates a **new** pack (repeat
sends create "X Pack" clones), and stamps every slot with the source-level `bpm`/`musicalKey`.

**F26 · P3 · UI promises macOS keys on Windows.** README and the Chop footer/tooltips show
`⌘Z`/`⇧⌘Z`/`⌘K` only; the handlers do accept Ctrl (`useShortcuts.ts:88`,
`CommandPalette.tsx:35`), so the *labels* are wrong on the shipped Windows build.

### 2.5 Missing functionality

**F27 · P1 · No cancellation or timeout for any long operation.** ffmpeg renders (per-chop sync,
pack export — 16 parallel spawns, or up to 128 for the generic profile), folder import, bulk
re-analyze, stem persist. A hung ffmpeg (corrupt input) leaves promises pending forever; the
only "cancel" in the app (stems) leaks its promise (F8). Direction: kill-on-timeout in
`renderClip`, concurrency cap in `exportClips`, AbortController plumbing.

**F28 · P2 · No input validation in main for region math.** `start`/`end` are trusted
everywhere (`audio:trimSource`, `saveChops`, `upsertChops`, slot bounds): `end <= start`,
negative, NaN, or Infinity flow straight into `setDuration(end - start)` → ffmpeg fatal error →
generic rejection (often swallowed, F7). The renderer mostly prevents this; main assumes it.
Direction: clamp/validate at the IPC boundary — it's ~10 lines.

**F29 · P2 · No observability.** `logMain` exists but only startup/fatal paths use it; every
`catch { /* ignore */ }` (12+ sites: unlinks, sync failures, materialization skips) is
invisible. A user reporting "my library lost samples" leaves nothing to inspect. Direction:
route swallowed errors through `logMain` at minimum.

**F30 · P3 · Settings writes are not atomic** (`settings.ts:18-20`) — a crash mid-write
truncates `settings.json`; `read()` then silently returns `{}` and the Freesound key vanishes
with no message. Write-temp-then-rename is one line.

### 2.6 Boundary & safety (Electron posture)

Overall posture is decent for a local-first app: context isolation on, node integration off,
no remote content in the window, `openExternal` restricted to `https:`, model files whitelisted
(`stems.ts:9,15-22` — tested against traversal in `stems.test.ts:45-48`). Remaining real items:

**F31 · P1 · `stems:persist` / `stems:getCached` path traversal via `sourceHash`.**
`stems.ts:24-30`: `path.join(userData, 'stems', sourceHash)` with a renderer-supplied string —
`'../../../../Users/x/.ssh'` escapes userData; `persistStems` then `mkdirSync`s and writes
attacker-shaped WAV bytes at the joined path (and `renderClip` output lands there too). Renderer
compromise is required, but this app's CSP deliberately allows `'unsafe-eval'` renderer-wide
(`main/index.ts:233` — `script-src 'self' 'unsafe-eval'`, not scoped to the worker), and the
renderer regularly renders strings from a remote API (Freesound names/tags — React escapes
them today). Defense-in-depth says validate: `/^[0-9a-f]{64}$/`. **CONFIRMED** (traversal is
real; exploitability gated on renderer compromise). Same class, lower stakes:
`freesound:download` fetches **any** renderer-supplied URL with Electron's net stack (SSRF /
arbitrary-content file write into staging), and `packs:export` / `audio:exportRegions` /
`library:importFolder` accept arbitrary absolute paths (write-anywhere / read-tree-anywhere
primitives). Direction: URL host allowlist (`freesound.org`, `cdn.freesound.org`); paths from
dialogs could be brokered by main instead of round-tripping through the renderer.

**F32 · P2 · The `local-file://` protocol serves the entire filesystem to the renderer, CORS
open.** `main/index.ts:184-222`: any path, no scoping to userData or user-picked roots, plus
`Access-Control-Allow-Origin: *` and `bypassCSP: true`. That is the app's design (library rows
point at arbitrary user files), but combined with F31's threat model it means any renderer-side
script can read any file on disk via `fetch('local-file:///etc/passwd')`. Direction: maintain an
allowed-roots set (userData + imported folders), 403 otherwise.

**F33 · P2 · Freesound API key handling is as documented but weak.** Plaintext in
`settings.json` (fine, documented in AGENTS.md), but it is re-read from disk on **every search**
(`freesound.ts:8-15`) and sent as a `token` query param (that's Freesound's API design). The
key never leaves the main process — good. Low risk; note only.

**F34 · P2 · Windows path correctness across the URL bridge.** `toLocalFileUrl`
(`src/utils/index.ts:40-43`) splits on `/` only; a Windows path `C:\Users\me\track.mp3` becomes
`local-file://C%3A%5CUsers%5Cme%5Ctrack.mp3` whose "hostname" the protocol handler
(`main/index.ts:185-190`) reassembles as `/C:\Users\me\track.mp3` — `existsSync` on that form is
at best accidental. `fileNameFromPath` has the same `/`-only assumption. The app ships a Windows
NSIS build; if this breaks, **no local file plays or renders a waveform on Windows** — yet
nothing in CI runs the renderer at all. **PLAUSIBLE** (needs a Windows run; possibly masked if
Chromium normalizes back-slashes in URLs). Direction: normalize `\` → `/` in `toLocalFileUrl`
and add a Windows smoke test.

### 2.7 Documentation & DX

**F35 · P2 · README has no build-from-source/contributing section.** `pnpm install` → postinstall
`electron-rebuild` (needs toolchain) → `pnpm dev`; none of it is in the README (only download
links). AGENTS.md covers it implicitly, but that's agent-facing. The
`NODE_MODULE_VERSION` footgun **is** well documented in AGENTS.md (accurate: tests stub electron
and avoid the DB), which is genuinely good.

**F36 · P2 · Seed script is macOS-only and destructive, and AGENTS.md bakes in the macOS
assumption.** `seed.sh:11-19` only knows `~/Library/Application Support/...`; on Linux
(`~/.config/samplebyte`) and Windows it exits "userData directory not found" even after
`pnpm dev`. AGENTS.md states "userData is always at ~/Library/Application Support/samplebyte/ in
both dev and production builds" — true only on macOS. The seed also `DELETE FROM samples` (the
user's whole dev library) without unlinking materialized WAVs (orphans), and its 1-based
`slot_number`s render shifted (F23). Docs claims vs reality otherwise check out: `pnpm dev`,
`pnpm test`, `pnpm release` flows match `package.json`/`tag.mjs`/workflows exactly, including
the fetch-stem-model-before-build requirement (present in `release.yml:22,40`).

**F37 · P3 · CI gap: nothing builds or launches the app.** `ci.yml` runs tsc/lint/vitest/audit —
solid — but no `vite build`, no electron-builder dry-run, no renderer test at all (all tests are
main-process services). A broken renderer import ships to a tag before anyone notices;
`release.yml` would then publish it (draft → undrafted automatically).

---

## 3. Design tensions (deepest structural issues)

**T1 — Three lifetimes, one `file_path` column.** Library rows point at (a) user-owned files
imported in place, (b) app-rendered WAVs in `userData/samples`, (c) cache artifacts
(`stems/`, `staging/`). The schema cannot distinguish them, so every consumer guesses:
`deleteSample` unlinks all three (F1), the stems cache gets corrupted, "staging" becomes
permanent (F21). *Alternative:* an `owned` flag (or path-prefix rule) enforced in one
`deleteSampleFiles()` helper; or copy-on-import so everything under the library is app-owned —
simpler invariant, more disk.

**T2 — Projection consistency by call-sequence, not by the data layer.** ADR-0006's "library is
a live projection" is implemented as "every writer remembers to call
`syncProjectChopsToLibrary` and no two calls overlap". Neither holds (F3, F4), and staleness is
decided by comparing wall-clock timestamps across tables (`isChopSampleStale`). *Alternative:*
serialize sync per project behind a queue in main, add UNIQUE(source_chop_id), and derive
staleness from a monotonic per-chop revision instead of `Date.now()` pairs.

**T3 — Durable state lives in the waveform widget.** Chop identity is the WaveSurfer region id;
names live in a React state map keyed by those ids; a trim rebuilds regions **without ids**
(`remapRegionsForTrim` drops them) so every trim rewrites all chop rows, re-renders all library
WAVs, and orphans every pack-slot chop reference — maximal churn for a metadata-preserving
operation. Zero-region states are indistinguishable from "editor not ready" (F5).
*Alternative:* the DB row is the chop; the region is a view of it (id round-trips through
trim; empty is a valid saved state).

**T4 — The hardware-profile abstraction is half real.** README: "adding a new hardware target is
just one config object". In reality a profile's `bitDepth` is ignored, its `sampleFmt` is passed
unvalidated into ffmpeg (F2), its `padCount` is ignored by the grid/UI (F19b), its filename
convention can self-collide (F6), and the renderer keeps its own profile list (F19a). A new
target added "as one config object" today would silently inherit all of this. *Alternative:*
make profiles the single source (serve via the existing dead `packs:getProfiles`), map
bit depth → codec in one place, test each profile's render.

**T5 — Trusted-renderer IPC in an unsafe-eval renderer.** The bridge is beautifully typed but
validates nothing at runtime; simultaneously the CSP grants `'unsafe-eval'` to the whole
renderer for the sake of one worker, and `local-file://` serves the disk CORS-open (F31, F32).
Each choice is individually defensible; together they mean one renderer bug = full disk
read/write. *Alternative:* validate at the boundary (hash regex, URL allowlist, path roots) —
cheap — and scope eval to the worker (serve the worker script with its own CSP header, or ship
demucs as a real module).

---

## 4. Expectation gaps ("I expected X, found Y")

- Expected deleting a library entry to remove a row; found it deletes the user's original file
  on disk (F1).
- Expected the advertised MPC/Generic 24-bit profiles to export; found an invalid ffmpeg flag
  that fails every render (F2) — and a UI that reports failure as success (F7).
- Expected autosave to be crash-safe and idempotent; found duplicate projects under fast editing
  (F3), duplicate samples under overlapping syncs (F4), and delete-all edits that never persist
  (F5).
- Expected "packs are independent snapshots" to mean pads survive library deletion; found
  deleteSample kills the pads (dialog does warn) while a sibling code path keeps them (F22), and
  pad audition depends on the live source anyway (F13).
- Expected the auto-updater to update; found an unreachable IPC surface — no user ever gets an
  update prompt (F18).
- Expected "Import to Library" on Freesound to import the sound; found it stages a 128 kbps
  preview and opens the editor, storing no license/attribution (F24).
- Expected `userData/sources`, `staging` and "cache" to be reclaimable; found they are permanent,
  growing, and load-bearing (F21).
- Expected the typed IPC contract to imply validated inputs; found path traversal in
  `stems:persist` and fetch-any-URL in `freesound:download` (F31).
- Expected `pnpm seed` (per AGENTS.md) to work after `pnpm dev`; found it is macOS-only and
  wipes the dev library (F36).
- Expected the test suite ("audio-rendering modules covered against real ffmpeg") to cover the
  shipped profiles; found only `s16` is ever rendered (F2, F37).

---

## 5. Open questions

1. Is in-place import (no copy) a deliberate product decision? It drives F1/T1; a one-line answer
   changes the right fix.
2. Is the Freesound preview-only download understood/accepted (vs. OAuth2 for originals), and is
   license attribution intentionally out of scope for exported packs?
3. Was the auto-update UI removed deliberately (0.0.x cadence via manual downloads), or lost in
   the refactor? `electron-updater` is still shipped either way.
4. Windows: has anyone run the packaged build end-to-end? (F34 would be immediately visible; the
   README documents the SmartScreen flow, which suggests Windows is a real target.)
5. `pitch_shift_semitones` / `time_stretch_ratio` — roadmap items or abandoned? They shape the
   slot schema and seed script today.
6. Generic profile `padCount: 128` — is >16-pad export intended soon? It determines whether the
   hardcoded 16s (grid, send-to-pack slice, recovery scan) are bugs or ceiling.
7. The `.harness/` ADRs are encrypted in-repo; should QA artifacts like this one be committed
   through the doctier filter (this environment has no filter configured, so this file is stored
   as written)?

---

## Appendix — strengths worth keeping

Not everything is adversarial: the typed IPC contract (`ipc-contract.ts`) with compile-time
channel/signature agreement is excellent; the render funnel (`renderClip` as the single ffmpeg
choke point) is the right shape (it just needs profile validation); the pad-owned-audio snapshot
model is a genuinely good design (enforce it in deletion and audition paths); virtualized
library/source lists, the analysis worker pool with transfer semantics, the electron test stub
approach, and the honest, current AGENTS.md are all above average for a solo side project.
