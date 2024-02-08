import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

export const getRegionsPlugin = (wavesurfer?: WaveSurfer) => {
  const regionsPluginInstance = wavesurfer
    ?.getActivePlugins()
    .find((plug) => plug instanceof RegionsPlugin);
  if (!regionsPluginInstance) return undefined;
  return regionsPluginInstance as RegionsPlugin;
};
