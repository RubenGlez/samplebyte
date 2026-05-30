# Roadmap

## Current state

Phases 1 and 2 of the original app build are complete: the app has a working Electron/React/SQLite foundation, a Chop view, Library view, Packs view, hardware export, project save/load, and Freesound search/download.

Phase 3 intelligence work is mostly complete: BPM detection, key detection, and transient-based auto-chop are shipped. The workflow model has moved away from Save to Library as a checkpoint: project regions/chops are persisted automatically and surfaced through the Library/source browser, while pack slots remain stable snapshots.

## Must-have

- [x] Auto-save project state and regions/chops - editing should never depend on a manual Save to Library checkpoint.
- [x] Make current project chops available in Pack Builder immediately - users should be able to build packs from live project work.
- [x] Dedicated Pack Builder - assemble sounds from project regions/chops and loose library samples through one source browser.
- [x] Pack slot snapshots - assigned chops or samples should remain stable so existing packs do not silently change when source chops are edited.
- [x] Target export profiles - support hardware, software, and folder destinations with naming and format conversion.
- [x] Search/filter sample browser - make it fast to build packs across projects and loose imports.
- [x] Remove or replace ambiguous Save to Library flow - clarify whether a sound is live project data, reusable library data, or exported pack data.
- [x] Library BPM/key filters - expose existing analysis metadata in the sample browser and Pack Builder filters.

## Should-have

- [ ] Direct recording into a project - capture audio from interfaces, turntables, keyboards, or phones without leaving the app.
- [x] Batch folder import and source-agnostic ingestion - bring existing sample folders into the workflow quickly.
- [x] Update-from-source affordance - show when a pack slot's original chop has changed and let the user refresh intentionally.
- [ ] Library management tools - support tagging, cleanup, auditioning, and metadata maintenance.
- [ ] Pitch shift/time stretch export options - tune or tempo-match exported packs without requiring a DAW. Quality should be competitive with Serato Pitch 'n Time as the market benchmark — the goal is not just having the feature but being good enough that producers do not feel they are downgrading from their DAW.
- [ ] Stem separation before chopping - isolate drums, bass, melody, or vocals from a mixed source (vinyl, full mixes, DAW bounces) before marking chop points. Serato Sample v2.0 made this a first-class feature and proved producer demand is real; not a fringe use case.
- [ ] More target profiles - add hardware/software presets such as Teenage Engineering EP-133, Elektron Digitakt, Polyend Play, Isla Instruments S2400, DAW folder layouts, and generic pad-controller mappings when the export model supports them cleanly.

## Nice-to-have

- [ ] AI auto-tagging and similar sound search - speed up library organization and pack discovery.
- [ ] Smart chop suggestions - propose a ranked list of chop points sorted by musical interest (transient density, energy, musical phrasing). Serato Sample's "Auto-Sample" finds up to 25 candidate points automatically; the goal here is a surfaced suggestion list the user can accept, reject, or refine rather than raw transient markers.
- [ ] Keyboard / melodic sampling mode - spread a chop or sample across a keyboard range for melodic and pitched use. Relevant for producers who work outside drum-machine pad workflows and want to play a sample chromatically.
- [ ] Pack coherence analysis - flag samples that clash tonally or rhythmically.
- [ ] MIDI export or DAW-oriented companion outputs - make packs easier to use outside hardware workflows.
- [ ] Waveform comparison - compare two samples visually for alignment or complementary pad placement.
- [ ] Cloud library sync - sync the SQLite database and media across machines if the product later needs multi-device continuity.

## Explicitly out of scope

- YouTube or streaming-service ripping integrations.
- DAW sequencing, mixing, or performance mode.
- Real-time effects processing as a primary product surface.
