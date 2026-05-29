<p align="center">
  <img src="public/icon.png" width="128" alt="SampleByte" />
</p>

# SampleByte

> A producer's sample workstation for hardware instruments.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rubenglez)

SampleByte is an open-source desktop app built to handle the full workflow from finding audio to loading a finished sample pack onto your hardware. No more jumping between tools.

---

## Why I built this

I produce music in my free time and own a Roland SP-404. Every time I wanted to load new samples onto it, I'd go through the same painful loop: find audio, download it with a separate tool, trim it in Audacity, rename files to match the SP-404's naming convention, copy everything to the SD card. Half an hour of friction before I even started making something.

So I built one app that does all of it:

```
Discover -> Chop -> Organise -> Export to your sampler
```

This is not a commercial product. It's open source, free to use, and built in my spare time. If it saves you some time, a coffee goes a long way.

---

## What It Does

- **Chop:** load any local audio file or search Freesound, draw regions on the waveform to mark your chops, name them, save them to your library
- **Library:** browse everything you've ever sampled, search and filter by BPM, key, or tag, preview with a click
- **Packs:** drag samples onto a 4x4 pad grid, pick your hardware target, export a ready-to-load folder with correctly named and formatted files

---

## Supported Hardware

| Device | Format | Sample Rate | Bit Depth |
|---|---|---|---|
| Maschine MK3 | WAV | 44.1 kHz | 16-bit |
| Roland SP-404 MkII | WAV | 48 kHz | 16-bit |
| Akai MPC (generic) | WAV | 44.1 kHz | 24-bit |
| Generic WAV | WAV | 44.1 kHz | 24-bit |

Adding a new hardware target is just one config object, no code changes needed. See [Architecture](docs/engineering/architecture.md#export-pipeline).

---

## Audio Sources

- **Local files:** drag and drop any audio file (WAV, MP3, FLAC, AIFF, OGG)
- **Freesound:** search 650,000+ Creative Commons sounds directly in the app

No YouTube. Not because it isn't useful (the original version of this app was built around it), but building on top of bypassing another platform's ToS is a dead end. Freesound covers discovery legally and with solid content. Local files cover everything else.

---

## Tech Stack

- **Electron 41** + **React 19** + **TypeScript**
- **Vite** + vite-plugin-electron
- **Zustand** for state management
- **better-sqlite3** for the sample library database
- **WaveSurfer.js** for waveform visualisation
- **fluent-ffmpeg** for audio export and conversion
- Custom **Web Audio API** algorithms for BPM and key detection (offline, no dependencies)
- **Tailwind CSS v4** + **shadcn/ui**

For the full architecture breakdown, see [architecture.md](docs/engineering/architecture.md).

---

## Roadmap

See [roadmap.md](docs/product/roadmap.md) for the full phased plan.

| Phase | Focus |
|---|---|
| 1 - Foundation | SQLite database, typed IPC, Zustand state management |
| 2 - Core | Chop, Library, Packs views + Freesound integration |
| 3 - Intelligence | BPM/key detection, auto-chop on transients, pitch shift |
| 4 - AI | Auto-tagging, stem separation, smart chop suggestions |

---

## Download

Pre-built installers are on the [Releases](https://github.com/RubenGlez/samplebyte/releases) page.

| Platform | File |
|---|---|
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |

### macOS: "Apple could not verify" warning

SampleByte is not notarized, so macOS Sequoia (15+) will block it on first launch.

**Option A - Terminal (easiest):**
```bash
xattr -cr /Applications/SampleByte.app
```
Then double-click the app normally.

**Option B - System Settings:**
1. Try to open the app and click OK on the warning dialog
2. Go to System Settings > Privacy & Security
3. Scroll down and click Open Anyway

### macOS: startup diagnostics

If the packaged app shows a JavaScript error before the main window opens, check:

```bash
cat ~/Library/Logs/samplebyte/main.log
```

The app also writes an emergency startup log to `/tmp/samplebyte-main.log`.

### Windows: SmartScreen warning

Click "More info" then "Run anyway" to get past the unsigned-app warning.

---

## Getting Started (from source)

```bash
git clone https://github.com/RubenGlez/samplebyte
cd samplebyte
pnpm install
pnpm dev   # development (hot reload)
pnpm build # production build
```

Requires Node.js v18+ and pnpm. The project pins its pnpm version in `package.json`.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Enter` | Play selected region |
| `Backspace` | Delete selected region |
| `Left / Right` | Select previous / next region |
| `Mouse wheel` | Zoom waveform |

---

## Contributing

SampleByte is still working toward its first real MVP. Contributions are welcome.

Before starting:
1. Read the [Roadmap](docs/product/roadmap.md) to see what's planned and what's in progress
2. Read the [Architecture](docs/engineering/architecture.md) to understand the codebase structure and conventions
3. Open an issue before starting anything large

---

## Acknowledgments

- [WaveSurfer.js](https://wavesurfer-js.org/) for waveform visualisation
- [Freesound](https://freesound.org/) for the Creative Commons audio API
- [Electron](https://www.electronjs.org/) for the cross-platform runtime

---

MIT, see [LICENSE](LICENSE). Built by [@RubenGlez](https://github.com/RubenGlez). [ko-fi.com/rubenglez](https://ko-fi.com/rubenglez)
