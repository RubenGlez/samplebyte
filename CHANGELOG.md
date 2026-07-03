# Changelog

All notable changes to SampleByte are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.26] - 2026-07-03

A hardening pass from a full adversarial code audit — correctness, safety, and a couple of features that were half-wired.

### Added

- **Automatic updates** — SampleByte now checks for new versions and offers to download and install them, instead of relying on manual downloads
- **Freesound attribution** — the license and author of Creative Commons sounds you keep are saved with them (shown as a `CC` chip in Browse), and a `credits.txt` is written next to your exported pack so you can honour attribution

### Fixed

- **Deleting a library entry no longer deletes your original file** — only audio SampleByte created (chops, rendered samples) is removed from disk; files you imported in place are left untouched
- **24-bit exports now work** — the Akai MPC and Generic WAV profiles were silently failing to render; they export correctly now
- **Export is honest and safe** — it reports how many files were actually written (and any failures) instead of always claiming success, de-duplicates pads that would share a filename, and can no longer hang on a corrupt file
- **Autosave** no longer creates duplicate projects or duplicate library samples during fast editing, and deleting your last chop (or "Clear all") now persists; a failed save now shows an error instead of a false "Saved"
- **Stem separation** no longer hangs when cancelled or run twice, and refuses over-long tracks with a clear message instead of crashing
- **Freesound search** shows an error when you're offline or your API key is wrong, instead of silently showing nothing
- **Pack pads** keep working after their source is deleted — deleting a library sample now leaves the pad recoverable instead of removing it, and pads audition from their own saved audio
- **Windows** file paths and keyboard-shortcut labels are handled correctly

### Changed

- Startup no longer stalls on the one-time chop migration (it runs in the background), and orphaned cache files are swept automatically
- Security hardening: the internal file server and the stem/download paths are now scoped and validated

## [0.0.25] - 2026-06-28

### Added

- **Command palette** — press ⌘K (or the ⌘K button in the toolbar) to jump between Chop, Library, and Packs, or to open an audio file or import a folder from anywhere

### Changed

- **Visual refresh** — musical values (BPM, key, duration, pad length) now share a consistent instrument-style readout; the waveform has more depth, with the played portion brighter; pads light up amber while they play
- **Consistent controls** — the segmented toggles across the app (tabs, source filters, tool options) now share one look and size; the main tabs read **Chop / Library / Packs**
- **Empty states** — the Projects and Packs lists now point you to the next step instead of just saying "none yet"

### Fixed

- **Keyboard focus** is now visible when tabbing through controls
- **Reduce motion** — animations, including the pad title scroll, are disabled when the system "Reduce motion" setting is on

## [0.0.24] - 2026-06-27

### Fixed

- **App icon on macOS 26 (Tahoe)** — the icon is now full-bleed (opaque to the edges) so Tahoe's system icon mask renders it without a white frame. The 0.0.23 icon used a transparent margin, which Tahoe filled with its white background plate

## [0.0.23] - 2026-06-26

### Changed

- **App icon** — redrawn to follow Apple's macOS icon template, so it no longer shows a white frame and sits like other native app icons
- **App name** — the application is now named **SampleByte** (the macOS bundle is `SampleByte.app`)

## [0.0.22] - 2026-06-26

### Added

- **Stem separation** — a new "Stems" tool on the Chop tab splits the active source into four offline stems (Drums, Bass, Other, Vocals) using a bundled model. Each stem becomes a swappable source, so the existing Chop, Loop, and Trim tools work on one instrument on its own; a selected stem can be saved to the Library. Results are cached per source so re-running is instant. The model is downloaded once with `pnpm fetch:stem-model` and is not bundled in the repo

## [0.0.21] - 2026-06-25

### Added

- **Pack recovery** — when a pad's source chop is edited, the pad flags it and offers "Update from source"; when the source chop is deleted, the pad offers "Regenerate to library" to rebuild its audio and relink, so a pad's sound is never stranded
- **Automatic chop names** — new chops are named after the audio file (e.g. "Think Break 1") instead of a generic "Chop 1", so they're easy to find in the library and in exports

### Changed

- **Clearer wording** — the slices you make are consistently called "chops" throughout the app (the old "region" wording is gone from the UI), and the imported audio is an "audio file"

## [0.0.20] - 2026-06-25

### Added

- **Pack independence** — pads snapshot their own trimmed audio at assignment, so an exported pad keeps working even if its original chop, sample, or source file is later changed, moved, or deleted
- **Automatic library sync** — project chops save automatically and appear in Browse and the Pack source list without a separate "Save to Library" step; editing or removing a chop updates the library to match
- **Bulk library actions** — select multiple samples in the Library to delete or re-analyze them in one pass

### Changed

- **Unified library** — chops, imported files, and Freesound downloads now live in one consistent sample model, so every row browses, filters, and previews the same way
- **Faster large libraries** — the Browse and Pack source lists are virtualized and show loading states, so big collections scroll smoothly

## [0.0.19] - 2026-06-16

### Added

- **Auto-loop detection** — auto-chop now identifies and selects loop candidates in long audio files
- **Improved auto-chop** — spectral flux analysis, beat-snap, and grid quantise modes for more accurate region detection
- **Library management** — inline rename on library rows, context menu with rename and delete actions, delete warns when a sample is referenced by existing packs, "Clean library" button removes orphaned entries
- **Batch folder import** — point at a folder of audio files to import them all at once; BPM and key are detected automatically and duplicates are skipped
- **Freesound enhancements** — category shortcut chips (Kick, Snare, Hi-Hat, 808, etc.) on the empty state, sort and duration pill filters that re-run the query instantly
- **Waveform miniatures** — Browse rows now show a waveform thumbnail for quick visual scanning
- **Pack slot source-change detection** — pack slots detect when their source audio has changed and surface a warning
