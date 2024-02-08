import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline";

interface UseWavesurferProps {
  audioUrl: string;
}

export const useWavesurfer = ({ audioUrl }: UseWavesurferProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const isConfigured = useRef(false);

  useEffect(() => {
    if (waveformRef.current && !isConfigured.current) {
      const regionsPluginInstance = RegionsPlugin.create();
      const timelinePluginInstance = TimelinePlugin.create({
        style: { color: "white" },
      });

      const wsInstance = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#1e293b",
        progressColor: "#64748b",
        cursorColor: "#f1f5f9",
        hideScrollbar: true,
        plugins: [regionsPluginInstance, timelinePluginInstance],
        url: audioUrl,
      });

      // Save the instace to expose it later
      setWavesurfer(wsInstance);

      isConfigured.current = true;
    }

    return () => {
      wavesurfer?.getActivePlugins().forEach((plug) => plug.unAll());
      wavesurfer?.destroy();
    };
  }, [audioUrl, wavesurfer]);

  return { waveformRef, wavesurfer };
};
