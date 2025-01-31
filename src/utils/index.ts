import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

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

export const humanizeAudioType = (mimeType: string): string => {
  const typeMap: { [key: string]: string } = {
    "audio/mpeg": "MP3 Audio",
    "audio/wav": "WAV Audio",
    "audio/ogg": "OGG Audio",
    "audio/aac": "AAC Audio",
    "audio/mp4": "MP4 Audio",
    "audio/flac": "FLAC Audio",
  };
  return typeMap[mimeType] || "Unknown Audio Format";
};

export const formatTime = (seconds: number) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(":");

export const convertBlobUrlToArrayBuffer = async (
  blobUrl: string
): Promise<ArrayBuffer> => {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Expected an ArrayBuffer"));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob); // Lee el blob como ArrayBuffer
    });
  } catch (error) {
    console.error("Error converting blob URL to ArrayBuffer:", error);
    throw error;
  }
};
