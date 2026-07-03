## Contributor notes

**Freesound API key:** Set inside the app's Settings UI (not a `.env` file). Stored at `$USERDATA/settings.json` (`app.getPath('userData')`). Only needed to use Freesound search inside the app — not required for seeding.

**Seed script:** Run `pnpm dev` at least once first (creates the SQLite database), then `pnpm seed`. Audio files are bundled in `scripts/seed-audio/` — no API key or network access needed. On macOS userData is at `~/Library/Application Support/samplebyte/` in both dev and production (prior to the `app.setName()` fix, dev mode used `~/Library/Application Support/Electron/`); on Linux it's `~/.config/samplebyte/` and on Windows `%APPDATA%\samplebyte\`. The seed script checks all three and only clears its own `seed-`prefixed rows, so it won't wipe your dev library.

**Stem separation model:** The Chop tab's Stems tool needs the vendored demucs WASM (`demucs.js` / `.wasm` / `.data`, ~85MB, MIT, originally from `uzstudio/free-music-demixer`). Run `pnpm fetch:stem-model` to download it into `public/stem-model/` (gitignored). The files are mirrored as assets on our own `stem-model-v1` GitHub release so the build does not depend on the upstream repo staying online; if those binaries ever need replacing, upload new assets there and update `BASE` in `scripts/fetch-stem-model.mjs`. Required before `pnpm build` if you want the feature in the packaged app; without it the tool reports a clear "run pnpm fetch:stem-model" error and the rest of the app is unaffected. The model is the 4-source variant (Drums/Bass/Other/Vocals) and runs single-threaded in a renderer web worker (slow: ~6.6× realtime, cached per source). Packaged CSP allows `'unsafe-eval'` because the Emscripten build is loaded from text and instantiates WebAssembly.

**Tests:** `pnpm test` (vitest). Tests run under plain Node, not Electron, so `electron` is aliased to a stub (`test/electron-stub.ts`) that points `app.getPath('userData')` at a temp dir. The audio-rendering modules are covered against real ffmpeg using the bundled seed fixtures. Tests cannot touch the database: `better-sqlite3` is rebuilt for Electron's ABI in `postinstall`, so constructing a `Database` under plain Node fails with a `NODE_MODULE_VERSION` mismatch — keep DB-dependent code out of the unit test path.

**Release:** Finalize the `CHANGELOG.md` entry (turn `[Unreleased]` into `[X.Y.Z] - <date>`) and commit it, then run `pnpm release` (or `release:minor` / `release:major`). `scripts/tag.mjs` requires a clean tree on `main` matching `origin/main`, bumps `package.json`, commits the bump, and pushes branch + tag. The `v*` tag triggers `.github/workflows/release.yml`, which builds macOS and Windows installers and un-drafts the GitHub release. Versioning convention is 0.0.x: every release is a patch bump (`pnpm release`), features included. The release workflow must run `pnpm fetch:stem-model` before `pnpm build:publish` — the demucs model is gitignored, and without it the packaged Stems tool ships in its error state.

<!-- doctier:begin -->
## Project context

Managed by doctier — do not edit between the markers.

Read these for project context:

- `.harness/adr/0001-local-first-electron-refactor.md`
- `.harness/adr/0002-stable-project-chops.md`
- `.harness/adr/0003-metadata-first-pack-slot-snapshots.md`
- `.harness/adr/0004-autosave-replaces-explicit-save.md`
- `.harness/adr/0005-pad-audition-mode-is-preview-only.md`
- `.harness/adr/0006-library-is-a-materialized-live-projection.md`
- `.harness/adr/0007-stem-separation-engine.md`
- `.harness/engineering/architecture.md`
- `.harness/engineering/features/auto-sample-suggestions.md`
- `.harness/engineering/features/pad-audition-mode.md`
- `.harness/engineering/features/stem-picker-chop-integration.md`
- `.harness/engineering/features/stem-separation-engine.md`
- `.harness/engineering/implementation-plan.md`
- `.harness/product/CONTEXT.md`
- `.harness/product/competitors.md`
- `.harness/product/idea.md`
- `.harness/product/product.md`
- `.harness/product/roadmap.md`
- `.harness/product/ux.md`
- `.harness/qa/report.md`
<!-- doctier:end -->
