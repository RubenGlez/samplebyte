## Contributor notes

**Freesound API key:** Set inside the app's Settings UI (not a `.env` file). Stored at `$USERDATA/settings.json` (`app.getPath('userData')`). Only needed to use Freesound search inside the app — not required for seeding.

**Seed script:** Run `pnpm dev` at least once first (creates the SQLite database), then `pnpm seed`. Audio files are bundled in `scripts/seed-audio/` — no API key or network access needed.
