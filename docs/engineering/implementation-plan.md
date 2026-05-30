# Implementation Plan

This plan is structured for small agent handoffs. SampleByte remains a local-first Electron desktop app: Electron main owns SQLite, filesystem, ffmpeg, export, Freesound, and future recording persistence; preload stays a typed `contextBridge`; React owns the renderer UI and calls domain stores. This is an incremental refactor of the existing Electron 41, React 19, TypeScript, Vite, Zustand, `better-sqlite3`, WaveSurfer.js, `fluent-ffmpeg`, Tailwind v4, shadcn, Radix, and lucide stack.

Baseline verification for each code task is `pnpm tsc`. The repo has no test runner today; add focused migration/query/export snapshot tests later if a test harness is introduced.

## Phase 1: Data Model Foundation

### Task 1.1 - Add project chop shared types

**Goal**: Introduce stable project chop concepts shared by Electron main, preload, and the renderer.

**Scope**: Update `electron/types.ts` and renderer type imports so projects expose `ProjectChop` with `id`, `name`, `start`, `end`, `createdAt`, and `updatedAt`. Keep compatibility with existing `ProjectRegion` shape during migration.

**Acceptance criteria**: `ProjectChop` is available to main and renderer code; existing callers that still use anonymous regions continue to type-check; `pnpm tsc` passes.

**Depends on**: None.

### Task 1.2 - Add normalized project_chops persistence

**Goal**: Store project chops as addressable rows so Pack Builder can browse chops from the current project and other projects.

**Scope**: Update `electron/main/db/index.ts` migrations to create `project_chops` with stable chop IDs, `project_id`, `name`, `start`, `end`, `created_at`, and `updated_at`. Add a compatibility migration from existing `projects.regions` JSON into normalized rows. Keep `projects.source_path` as the source audio path for now.

**Acceptance criteria**: Existing databases with `projects.regions` migrate without losing regions; new databases create `project_chops`; repeated app starts do not duplicate migrated chops; `pnpm tsc` passes.

**Depends on**: Task 1.1.

### Task 1.3 - Add project chop queries and IPC typing

**Goal**: Make project chops readable and writable through the existing main -> preload -> renderer boundary.

**Scope**: Add query functions under `electron/main/db/queries/` for listing by project, listing across projects, upserting, deleting, and touching `updatedAt`. Wire IPC handlers, preload bridge methods, and `src/types/global.d.ts` declarations following the existing `domain:operation` invoke/handle pattern.

**Acceptance criteria**: Renderer code can fetch current-project and cross-project chops without direct DB access; chop edits persist with updated timestamps; `pnpm tsc` passes.

**Depends on**: Task 1.2.

### Task 1.4 - Add pack slot snapshot schema

**Goal**: Replace sample-only pack slots with metadata-first snapshots that remain stable when source chops change.

**Scope**: Extend `pack_slots` storage and `PackSlot` types to include source type/path, optional `projectId`, optional `projectChopId`, optional `sampleId`, region `start`/`end`, display name, stored `sourceChopUpdatedAt`, and placeholder export settings for later pitch/time stretch. Add migration compatibility for existing `sample_id` slots.

**Acceptance criteria**: Existing sample-based pack slots remain loadable; new slot rows can represent project chops or library samples; no audio file is copied or rendered when a slot is assigned; `pnpm tsc` passes.

**Depends on**: Task 1.1.

## Phase 2: Project Autosave and Chop Workflow

### Task 2.1 - Persist region edits as project chops automatically

**Goal**: Remove manual Save to Library as the required checkpoint for keeping chop work.

**Scope**: Update `src/stores/projects.ts` and the Chop view integration so region create, rename, resize, and delete operations persist to project chops automatically. Preserve project source path when local audio is loaded or trimmed.

**Acceptance criteria**: Editing chops updates persisted project chop rows without requiring Save to Library; reloading a project restores the same chop IDs and names; `pnpm tsc` passes.

**Current implementation**: Region edits auto-save with a 1500ms debounce and a 5s maximum wait. A "Saving…" / "✓ Saved" status indicator appears in the Chop header for user-triggered changes. The explicit Save Project / Update Project buttons have been removed.

**Depends on**: Task 1.3.

### Task 2.2 - Remove Save to Library from the main path

**Goal**: Clarify that the library is an optional reusable archive, not the required transition between Chop and Pack.

**Scope**: Remove Save to Library from the Chop workflow. Project chops are persisted automatically and indexed by the Library/source browser, while the primary flow moves from project chops to Pack Builder.

**Acceptance criteria**: A user can chop source audio and proceed toward pack building without saving or exporting samples to the library; the Library automatically includes project regions; loose/reusable sample import remains separate from project chopping; `pnpm tsc` passes.

**Current implementation**: Save to Library has been removed from the primary Chop workflow. Project chops persist automatically and appear in the Library source browser without a manual save step.

**Depends on**: Task 2.1.

### Task 2.3 - Add create/send chops to pack shortcut

**Goal**: Let users create a draft pack from the current project without leaving live chop data behind.

**Scope**: Add a `Create pack from chops` or `Send chops to pack` action that creates a pack, assigns selected or all current project chops as slot snapshots, and routes the user to Pack Builder.

**Acceptance criteria**: The shortcut creates a draft pack from current project chops; slots contain snapshot payloads, not only `sample_id`; Pack Builder opens with the new pack selected; `pnpm tsc` passes.

**Current implementation**: Shipped. The Chop view includes a "Create pack from chops" action that builds a draft pack from the current project chops and opens Pack Builder with the new pack selected.

**Depends on**: Task 1.4, Task 2.1.

## Phase 3: Pack Builder Source Browser

### Task 3.1 - Model Pack Builder source items

**Goal**: Give Pack Builder one typed source model for current project chops, other project chops, and library samples.

**Scope**: Add renderer types and selector/store helpers that normalize project chops and samples into source browser items with source type, display name, source path, duration/region, project metadata, and IDs.

**Acceptance criteria**: Source items can be built from current project chops, cross-project chops, and library samples; source items contain enough metadata to build a pack slot snapshot; `pnpm tsc` passes.

**Depends on**: Task 1.3, Task 1.4.

### Task 3.2 - Build unified Pack Builder source browser

**Goal**: Let users browse and search all valid pack sources from the Pack Builder without duplicating the Library model.

**Scope**: Update Packs/Pack Builder UI to show one source list backed by project chops and loose library samples. Do not split the browser into Current Project, Other Projects, and Library sections; use search and filters to narrow by project/source metadata instead.

**Acceptance criteria**: Current project chops appear immediately because they are indexed project regions; other project chops and library samples are discoverable in the same list; search/filter works across the source browser; `pnpm tsc` passes.

**Depends on**: Task 3.1.

### Task 3.3 - Assign any source item to a pad slot snapshot

**Goal**: Make pad assignment source-agnostic and snapshot-based.

**Scope**: Update `src/stores/packs.ts`, pack slot queries, and drag/drop handlers so `setSlot` accepts a normalized source item and writes the full snapshot payload.

**Acceptance criteria**: Dragging a current project chop, other project chop, or library sample into a pad creates a stable slot snapshot; no assignment path writes only `sample_id`; `pnpm tsc` passes.

**Depends on**: Task 3.1, Task 1.4.

## Phase 4: Export and Source-Change Correctness

### Task 4.1 - Export packs from slot snapshots

**Goal**: Render exported files from slot metadata and target export profiles.

**Scope**: Update pack export IPC/main logic to resolve each slot snapshot's source path and region, then call ffmpeg with the selected hardware/profile formatting. Keep existing library sample slots exportable through migrated snapshot data.

**Acceptance criteria**: Export does not depend on a live project chop lookup unless the user explicitly refreshes a slot; migrated older packs export; exported files follow the selected profile naming and format; `pnpm tsc` passes.

**Current implementation**: Shipped. Export resolves each slot's snapshot metadata and source path through the main process, applies the selected target profile via ffmpeg, and writes hardware/folder-ready files.

**Depends on**: Task 1.4, Task 3.3.

### Task 4.2 - Detect changed source chops

**Goal**: Surface when a pack slot's original project chop has changed without silently mutating the slot.

**Scope**: Compare stored `sourceChopUpdatedAt` against the current project chop `updatedAt` where a slot has a project/chop reference. Expose status in Pack Builder and add actions to update from source or keep the snapshot.

**Acceptance criteria**: Changed project chop sources are detected; users can intentionally refresh the slot snapshot; keeping the snapshot leaves export behavior unchanged; `pnpm tsc` passes.

**Current implementation**: Pack slots compare their stored `sourceChopUpdatedAt` with the current project chop row. Changed slots show a `Source changed` status in the pad and expose a refresh button that overwrites the slot snapshot from the current source chop. If the user does nothing, the existing snapshot remains the export source.

**Depends on**: Task 4.1.

### Task 4.3 - Verify migration and export edge cases

**Goal**: Protect older user data and snapshot export behavior during the refactor.

**Scope**: Manually exercise migrated projects, migrated packs, library sample slots, project chop slots, missing source files, and changed source chops. If a test runner is introduced later, add focused DB migration/query tests and export snapshot tests.

**Acceptance criteria**: Documented manual checks pass; `pnpm tsc` passes; known missing-file behavior is explicit in UI or error handling.

**Current implementation**: Shipped. Manual migration/export checks have been completed. See `docs/engineering/migration-export-edge-cases.md` for the verified matrix and expected behavior.

**Depends on**: Task 4.1, Task 4.2.

## Phase 5: Import, Library, and Recording

### Task 5.1 - Improve batch folder import

**Goal**: Make existing sample folders easy to ingest as loose/reusable library assets.

**Scope**: Add or improve folder import flow, metadata extraction, duplicate handling, and library indexing for local audio files.

**Acceptance criteria**: Users can import a folder of supported audio files; imported assets appear in Library and Pack Builder; duplicates are handled predictably; `pnpm tsc` passes.

**Depends on**: Phase 4.

### Task 5.2 - Improve library metadata management

**Goal**: Keep the library useful as a searchable asset archive.

**Scope**: Add focused metadata editing, tagging, cleanup, auditioning, and filters for reusable library samples without making library save mandatory for pack creation.

**Acceptance criteria**: Users can search/filter and maintain library assets; metadata edits do not affect stable pack slot snapshots unless refreshed intentionally; `pnpm tsc` passes.

**Depends on**: Phase 4.

### Task 5.3 - Add direct recording into projects

**Goal**: Support recording from interfaces, turntables, keyboards, and phones after the data model refactor is stable.

**Scope**: Add recording capture, persistence, project source creation, and initial chop workflow integration through Electron main and typed preload APIs.

**Acceptance criteria**: A recorded source can be saved as project audio, chopped, assigned to pack slots as snapshots, and exported through profiles; `pnpm tsc` passes.

**Depends on**: Phase 4.
