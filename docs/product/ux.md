# UX & Design Direction

## Core workflow

1. Import or record a sound.
2. Chop and refine it inside a project.
3. Send chops to a pack or open Pack Builder.
4. Assemble pads or folder outputs from current project chops, other project chops, and library samples.
5. Choose a target profile.
6. Export predictable, target-ready files.

The library remains available as the searchable asset archive and browser used inside Pack Builder. It is not a mandatory checkpoint in the happy path.

## Interaction model

SampleByte should feel desktop-native, dense, fast, and utility-first. Producers should be able to use drag and drop, keyboard shortcuts, fast preview, inline rename, batch actions, and predictable file output controls. The app should make the distinction between projects, packs, and library assets clear at every step.

Dedicated Pack Builder remains the final assembly and export surface. The Chop view may include shortcuts such as Create pack from chops or Send chops to pack, but pack assembly should still resolve through the Pack Builder model.

## Design register

The visual register should feel like a macOS utility app: clear, calm, and confidence-inspiring rather than flashy, social, or marketplace-like. The UI should make object ownership obvious: projects are live and editable, packs are stable snapshots with optional refresh from source, and the library is an indexed asset store.

Delight should come from speed and certainty: previewing immediately, dragging a chop into place, seeing the correct target naming, and exporting files that can be loaded without cleanup.

## Key UX decisions

- Current project chops should be usable in Pack Builder immediately, without forcing a Save to Library step.
- Pack slots should snapshot assigned chop or sample state, with an explicit update-from-source action when the original changes.
- The library should support search, filtering, preview, and reuse across projects, but it should not block the primary import-to-pack workflow.
