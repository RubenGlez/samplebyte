import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

// The shortcut handlers accept both Cmd and Ctrl, but the labels used to show ⌘ only — wrong on the
// shipped Windows build (F26). Format modifier hints per platform.
export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modLabel = (key: string): string => (IS_MAC ? `⌘${key}` : `Ctrl+${key}`);
export const modShiftLabel = (key: string): string => (IS_MAC ? `⇧⌘${key}` : `Ctrl+Shift+${key}`);

export const getRegionsPlugin = (wavesurfer?: WaveSurfer) => {
  const regionsPluginInstance = wavesurfer
    ?.getActivePlugins()
    .find((plug) => plug instanceof RegionsPlugin);
  if (!regionsPluginInstance) return undefined;
  return regionsPluginInstance as RegionsPlugin;
};

export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const EXT_TO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
}

export const mimeTypeFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? 'audio/*'
}

export const fileNameFromPath = (filePath: string): string =>
  // Split on both separators so a Windows path (C:\...\track.mp3) yields the basename, not the whole
  // string (F34).
  filePath.split(/[\\/]/).pop() ?? 'audio'

export const toLocalFileUrl = (filePath: string): string => {
  // Normalize Windows separators to '/' so a path like C:\Users\me\track.mp3 produces a valid URL
  // instead of one whose backslashes get mangled into the authority (F34). Build with an empty
  // authority (leading '/') so the drive letter lives in the path, and the main-process protocol
  // handler reconstructs it (stripping the leading slash before a drive letter).
  const normalized = filePath.replace(/\\/g, '/')
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  const encodedPath = withLeadingSlash.split('/').map(encodeURIComponent).join('/')
  return `local-file://${encodedPath}`
}

export const humanizeAudioType = (mimeType: string): string => {
  const typeMap: Record<string, string> = {
    'audio/mpeg': 'MP3',
    'audio/mp3':  'MP3',
    'audio/wav':  'WAV',
    'audio/ogg':  'OGG',
    'audio/aac':  'AAC',
    'audio/mp4':  'M4A',
    'audio/flac': 'FLAC',
    'audio/aiff': 'AIFF',
  }
  return typeMap[mimeType] ?? 'Audio'
}

export const formatTime = (seconds: number) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(":");

// Default label for an unnamed chop: the song/project name plus a 1-based number, e.g. "Think Break 1".
// Falls back to "Chop" when there is no project name, preserving the original default.
export const defaultChopName = (projectName: string, index: number): string =>
  `${projectName.trim() || "Chop"} ${index + 1}`;

