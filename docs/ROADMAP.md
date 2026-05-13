# Roadmap

This is a phased plan ordered by dependency and user impact. Each phase produces something usable before the next begins.

---

## Phase 1 — Foundation

The plumbing everything else builds on. No new user-facing features, but the existing code becomes stable and maintainable.

- [ ] Replace `ipcMain.on`/`event.sender.send` pattern with `ipcMain.handle`/`ipcRenderer.invoke` across all IPC channels
- [ ] Typed contextBridge in preload (replace the current stringly-typed `send`/`receive` API)
- [ ] Set up `better-sqlite3` with migrations (samples, packs, pack_slots, projects tables)
- [ ] Set up Zustand stores (player, library, packs)
- [ ] Remove `ytdl-core` and all YouTube-related code
- [ ] Upgrade Tailwind to v4, add shadcn/ui

**Exit criteria:** The app loads, plays audio, and saves regions. No YouTube. No crashes from listener leaks.

---

## Phase 2 — Core Features

The full three-view workflow from audio in to hardware pack out.

### Chop view
- [ ] SourcePicker — drag local file or search Freesound (search UI, not download yet)
- [ ] WaveformEditor with region creation, naming, deletion
- [ ] RegionList with editable names and duration display
- [ ] Save regions as samples to the library (IPC → SQLite)
- [ ] Project save/load (reopen a session and its source audio)

### Library view
- [ ] SampleGrid — browse all saved samples
- [ ] Click to preview (inline waveform or just audio playback)
- [ ] Search by name
- [ ] Filter by tags
- [ ] Delete sample

### Packs view
- [ ] PadGrid — visual 4×4 layout
- [ ] Drag sample from Library onto a pad slot
- [ ] Hardware profile picker (Maschine MK3, SP-404 MkII, MPC, Generic)
- [ ] Export pack — ffmpeg trims + resamples each slot, writes named files to chosen output folder
- [ ] Save/load named packs

### Freesound integration
- [ ] Search with query and pagination
- [ ] Preview audio in app before downloading
- [ ] Download to local cache, add to library automatically
- [ ] Store `freesound_id` on sample for attribution

**Exit criteria:** A producer can load a local audio file, chop it, save the chops, build a 16-pad pack, and export hardware-ready WAV files. End-to-end workflow complete.

---

## Phase 3 — Intelligence

Audio analysis features that make chopping faster and smarter. All run offline via WASM or native binaries — no cloud dependency.

- [ ] **BPM detection** — `essentia.js` analyses audio on load, stores result in the sample record. Displayed in the Chop view header and Library card.
- [ ] **Key detection** — same pipeline as BPM. Musical key (e.g. "C minor") stored and filterable in the Library.
- [ ] **Transient detection → auto-chop** — detect peaks/onsets in the waveform and auto-generate regions at transient points. One-click to slice a drum break into individual hits.
- [ ] **Filter Library by BPM / key** — now that samples have analysis data, enable numeric BPM range filter and key filter in the Library view.
- [ ] **Pitch shift on export** — specify a semitone offset per pack slot; ffmpeg applies it via rubberband on export. Lets you tune samples to a key before loading hardware.
- [ ] **Time stretch on export** — specify a target BPM per pack; ffmpeg stretches/compresses each sample to match.

**Exit criteria:** Audio loaded into the Chop view shows BPM and key automatically. One button slices at transients. Exported packs can be pitch-shifted without touching a DAW.

---

## Phase 4 — AI Features

Higher-effort features that require model inference. Sequenced last because they build on the stable foundation of Phase 1–3.

- [ ] **Auto-tagging** — when a sample is saved to the library, run inference to suggest instrument and mood tags (e.g. "kick", "snare", "pad", "atmospheric"). User can confirm or edit before saving.
- [ ] **Smart chop suggestions** — given a loaded track, suggest the most musically interesting N-second segments to chop, based on energy, novelty, and rhythmic density. User picks from suggestions or ignores them.
- [ ] **Stem separation** — before chopping, separate the audio into drums, bass, melody, and vocals using a local model (demucs or similar). Chop the stems independently. Gives producers cleaner one-shots from full tracks.
- [ ] **Similar sound search** — in the Library, "find similar" on a sample surfaces the closest matches by timbral embedding. Useful when building a pack and looking for complementary sounds.
- [ ] **Pack coherence analysis** — given a completed pack, flag pad slots whose samples clash tonally or rhythmically. Suggest substitutions from the library.

---

## Future Ideas (Unscheduled)

Things worth considering but not yet committed to:

- **Waveform comparison** — overlay two samples to check alignment before assigning to adjacent pads
- **MIDI export** — alongside the audio pack, export a MIDI file with notes mapped to the pad layout (useful for DAW integration)
- **Sample rate / format conversion on import** — normalise all imported files to a canonical format at library add time, not at export time
- **Batch import** — drop a folder, import all audio files at once
- **Cloud library sync** — sync the SQLite database and sample files across machines (complex; would need a backend)
- **More hardware profiles** — Teenage Engineering EP-133, Elektron Digitakt, Polyend Play, Isla Instruments S2400
- **VST / AU plugin mode** — a companion plugin that reads SampleByte packs and loads them into your DAW (very long term)

---

## What We Are Explicitly Not Building

- **YouTube integration** — legal exposure from bypassing ToS, dependency on a platform actively fighting the integration
- **A DAW** — SampleByte is a sampling workstation, not a sequencer or mixer
- **A streaming service integration** — same legal exposure as YouTube
- **Real-time audio effects processing** — out of scope; handle this in your DAW or on the hardware itself
