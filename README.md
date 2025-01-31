# SampleByte

> ⚠️ **Work In Progress**: This software is under active development and may contain bugs or incomplete features. Use at your own risk and feel free to report any issues you encounter.

SampleByte is an open-source Digital Audio Workstation (DAW) focused on making music sampling accessible and efficient. Built with Electron and React, it allows producers to sample directly from YouTube or local audio files with a streamlined workflow.

![SampleByte Screenshot] [Add screenshot here]

## Features

- 🎵 Direct YouTube sampling
- 🎚️ Waveform visualization with zoom capabilities
- ✂️ Create and manage multiple sample regions
- 💾 Save and load projects
- 🎹 Keyboard shortcuts for efficient workflow
- 🎨 Modern, minimal interface

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository

### Building

To create a production build:

```bash
npm run build
```

The built application will be available in the `release` directory.

## Usage

1. Launch SampleByte
2. Either:
   - Paste a YouTube URL to load audio
   - Drop a local audio file into the interface
3. Use the waveform view to create regions by clicking and dragging
4. Save your project or export individual samples

### Keyboard Shortcuts

- `Space`: Play/Pause
- `Enter`: Play selected region
- `Backspace`: Delete selected region
- Mouse wheel: Zoom waveform

## Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [WaveSurfer.js](https://wavesurfer-js.org/) for audio visualization
- [ytdl-core](https://github.com/fent/node-ytdl-core) for YouTube download functionality
- [Electron](https://www.electronjs.org/) for the cross-platform runtime
- [React](https://reactjs.org/) for the UI framework

## Roadmap

- [ ] Export to multiple audio formats
- [ ] Batch processing of samples
- [ ] Effects processing
- [ ] MIDI mapping support
- [ ] Sample library management

## Support

If you find this project helpful, please consider:
- Starring the repository
- Reporting bugs
- Contributing code or documentation
- Sharing with other producers

---

Built with ♥️ by @RubenGlez
