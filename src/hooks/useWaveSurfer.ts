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
      const wsInstance = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "rgba(255,255,255,0.33)",
        progressColor: "#fff",
        cursorColor: "#fff",
        hideScrollbar: true,
        autoCenter: false,
        autoplay: false,
        autoScroll: false,

        plugins: [
          RegionsPlugin.create(),
          TimelinePlugin.create({
            style: { color: "white" },
          }),
        ],
        url: audioUrl,
      });

      // Save the instace to expose it later
      setWavesurfer(wsInstance);

      isConfigured.current = true;
    }

    return () => {
      wavesurfer?.destroy();
    };
  }, [audioUrl, wavesurfer]);

  return { waveformRef, wavesurfer };
};
