# Changelog

All notable changes to SampleByte are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
