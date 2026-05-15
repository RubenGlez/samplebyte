# SampleByte

<p align="center">
  <img src="public/icon.png" width="128" alt="SampleByte" />
</p>

> A producer's sample workstation for hardware instruments.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rubenglez)

SampleByte is an open-source desktop app that covers the full workflow from audio discovery to hardware-ready sample packs — without the fragmented, multi-tool process producers deal with today.

```
Discover → Chop → Organise → Export to your sampler
```

---

## Why I built this

I produce music in my free time and own a Roland SP-404. Every time I wanted to load new samples onto it, I'd go through the same painful loop: find audio somewhere, download it with a separate tool, trim it in Audacity, rename the files to match the SP-404's naming convention, and copy everything to the SD card. Half an hour of friction before I even started making something.

I built SampleByte to collapse that into a single app. It's a personal tool first — but it's also a project I'm genuinely proud of, and I wanted to build it properly: typed IPC, a real database, a clean architecture, and a UI that actually looks good.

This is not a commercial product. It's open source, free to use, and built in my spare time. If it's useful to you, a coffee goes a long way.

---

## The Problem

Loading samples onto hardware (Maschine MK3, Roland SP-404, Akai MPC) is tedious. Today's workflow looks like this:

1. Find audio somewhere
2. Download it with a separate tool
3. Open an audio editor (Audacity, a DAW)
4. Trim and chop manually
5. Export individual files
6. Rename them to match your hardware's naming convention
7. Copy to the right folder on your SD card or USB

SampleByte collapses that into one tool.

---

## What It Does

- **Chop** — Load any local audio file or search Freesound. Draw regions on the waveform to mark your chops. Name them. Save them to your library.
- **Library** — Browse everything you've ever sampled. Search and filter by BPM, key, or tag. Preview with a click.
- **Packs** — Drag samples onto a visual 4×4 pad grid. Pick your hardware target. Export a ready-to-load folder of correctly formatted, correctly named files.

---

## Supported Hardware (Export Profiles)

| Device | Format | Sample Rate | Bit Depth |
|---|---|---|---|
| Maschine MK3 | WAV | 44.1 kHz | 16-bit |
| Roland SP-404 MkII | WAV | 48 kHz | 16-bit |
| Akai MPC (generic) | WAV | 44.1 kHz | 24-bit |
| Generic WAV | WAV | 44.1 kHz | 24-bit |

Adding a new hardware target is one config object — no code changes required. See [Architecture](docs/ARCHITECTURE.md#hardware-profiles).

---

## Audio Sources

- **Local files** — drag and drop any audio file (WAV, MP3, FLAC, AIFF, OGG)
- **Freesound** — search 650,000+ Creative Commons sounds directly in the app

No YouTube. Not because it isn't useful — the original version of this app was built around it. But building a product on top of bypassing another platform's ToS creates a ceiling the product can never escape. Freesound covers the discovery angle legally and with quality content, and local files cover everything else.

---

## Tech Stack

- **Electron 33** + **React 19** + **TypeScript**
- **Vite** + vite-plugin-electron
- **Zustand** for state management
- **better-sqlite3** for the sample library database
- **WaveSurfer.js** for waveform visualisation
- **fluent-ffmpeg** for audio export and conversion
- Custom **Web Audio API** algorithms for BPM and key detection (offline, no dependencies)
- **Tailwind CSS v4** + **shadcn/ui**

For the full architecture breakdown, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for the full phased plan.

| Phase | Focus |
|---|---|
| 1 — Foundation | SQLite database, typed IPC, Zustand state management |
| 2 — Core | Chop, Library, Packs views + Freesound integration |
| 3 — Intelligence | BPM/key detection, auto-chop on transients, pitch shift |
| 4 — AI | Auto-tagging, stem separation, smart chop suggestions |

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Install

```bash
git clone https://github.com/RubenGlez/samplebyte
cd samplebyte
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Enter` | Play selected region |
| `Backspace` | Delete selected region |
| `Mouse wheel` | Zoom waveform |

---

## Contributing

SampleByte is in active development toward its first real MVP. Contributions are welcome.

Before starting:
1. Read the [Roadmap](docs/ROADMAP.md) to see what's planned and what's in progress
2. Read the [Architecture](docs/ARCHITECTURE.md) to understand the codebase structure and conventions
3. Open an issue before starting anything large

---

## Acknowledgments

- [WaveSurfer.js](https://wavesurfer-js.org/) for waveform visualisation
- [Freesound](https://freesound.org/) for the Creative Commons audio API
- [Electron](https://www.electronjs.org/) for the cross-platform runtime

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by [@RubenGlez](https://github.com/RubenGlez) · [ko-fi.com/rubenglez](https://ko-fi.com/rubenglez)
