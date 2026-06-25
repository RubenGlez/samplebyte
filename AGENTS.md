## Contributor notes

**Freesound API key:** Set inside the app's Settings UI (not a `.env` file). Stored at `$USERDATA/settings.json` (`app.getPath('userData')`). Only needed to use Freesound search inside the app — not required for seeding.

**Seed script:** Run `pnpm dev` at least once first (creates the SQLite database), then `pnpm seed`. Audio files are bundled in `scripts/seed-audio/` — no API key or network access needed. userData is always at `~/Library/Application Support/samplebyte/` in both dev and production builds (prior to the `app.setName()` fix, dev mode used `~/Library/Application Support/Electron/` instead).

**Tests:** `pnpm test` (vitest). Tests run under plain Node, not Electron, so `electron` is aliased to a stub (`test/electron-stub.ts`) that points `app.getPath('userData')` at a temp dir. The audio-rendering modules are covered against real ffmpeg using the bundled seed fixtures. Tests cannot touch the database: `better-sqlite3` is rebuilt for Electron's ABI in `postinstall`, so constructing a `Database` under plain Node fails with a `NODE_MODULE_VERSION` mismatch — keep DB-dependent code out of the unit test path.
