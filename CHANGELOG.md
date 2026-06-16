# Changelog

All notable changes to SampleByte are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.19] - 2026-06-16

### Added

- **Auto-loop detection** — auto-chop now identifies and selects loop candidates in long audio files
- **Improved auto-chop** — spectral flux analysis, beat-snap, and grid quantise modes for more accurate region detection
- **Library management** — inline rename on library rows, context menu with rename and delete actions, delete warns when a sample is referenced by existing packs, "Clean library" button removes orphaned entries
- **Batch folder import** — point at a folder of audio files to import them all at once; BPM and key are detected automatically and duplicates are skipped
- **Freesound enhancements** — category shortcut chips (Kick, Snare, Hi-Hat, 808, etc.) on the empty state, sort and duration pill filters that re-run the query instantly
- **Waveform miniatures** — Browse rows now show a waveform thumbnail for quick visual scanning
- **Pack slot source-change detection** — pack slots detect when their source audio has changed and surface a warning
