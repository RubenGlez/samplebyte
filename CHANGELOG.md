# Changelog

All notable changes to SampleByte are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
