# UX & Design Direction

## Core workflow

1. Import or record a sound.
2. Chop and refine it inside a project.
3. Project regions/chops are persisted automatically and become visible in the Library/source browser.
4. Send chops to a pack or open Pack Builder.
5. Assemble pads or folder outputs from project chops and loose samples through one unified source browser.
6. Choose a target profile.
7. Export predictable, target-ready files.

The Library is the searchable index of project regions/chops and loose imported samples. It is not a manual export checkpoint in the happy path.

## Interaction model

SampleByte should feel desktop-native, dense, fast, and utility-first. Producers should be able to use drag and drop, keyboard shortcuts, fast preview, inline rename, undo/redo for region edits, batch actions, and predictable file output controls. The app should make the distinction between projects, packs, and library assets clear at every step.

Dedicated Pack Builder remains the final assembly and export surface. The Chop view may include shortcuts such as Create pack from chops or Send chops to pack, but pack assembly should still resolve through the Pack Builder model. Pack Builder should not split sources into separate Current Project / Other Projects / Library sections; the chosen model is one source browser with search and filters. Current-project chops still appear immediately because they are part of the indexed project region set.

## Design register

The visual register should feel like a macOS utility app: clear, calm, and confidence-inspiring rather than flashy, social, or marketplace-like. The UI should make object ownership obvious: projects are live and editable, packs are stable snapshots with optional refresh from source, and the library is an indexed asset store.

Delight should come from speed and certainty: previewing immediately, dragging a chop into place, seeing when a slot's source has changed, refreshing intentionally when desired, seeing the correct target naming, and exporting files that can be loaded without cleanup.

## Key UX decisions

- Current project chops should be usable in Pack Builder immediately, without forcing a Save to Library step.
- The Pack Builder source browser is unified: project regions and loose samples appear in one searchable/filterable list.
- Pack slots should snapshot assigned chop or sample state, with an explicit update-from-source action when the original changes.
- The Library should support search, filtering, preview, and reuse across projects, and should automatically include project regions. It should not block the primary import-to-pack workflow.
