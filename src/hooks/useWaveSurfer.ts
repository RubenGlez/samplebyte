import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline";

interface UseWavesurferProps {
  audioUrl: string;
}

export const useWavesurfer = ({ audioUrl }: UseWavesurferProps) => {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const [isPlaying, setIsPlaying] = useState(false);
  const isConfigured = useRef(false);

  useEffect(() => {
    if (waveformRef.current && !isConfigured.current) {
      const wsInstance = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "rgba(240, 228, 210, 0.25)",
        progressColor: "rgba(240, 228, 210, 0.55)",
        cursorColor: "#FF5500",
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        hideScrollbar: true,
        autoCenter: false,
        autoplay: false,
        autoScroll: false,
        height: 96,
        plugins: [
          RegionsPlugin.create(),
          TimelinePlugin.create({
            style: {
              color: "rgba(255,180,100,0.3)",
              fontSize: "10px",
              fontFamily: "'JetBrains Mono', monospace",
            },
          }),
        ],
        url: audioUrl,
      });

      wsInstance.on('play',   () => setIsPlaying(true));
      wsInstance.on('pause',  () => setIsPlaying(false));
      wsInstance.on('finish', () => setIsPlaying(false));

      setWavesurfer(wsInstance);
      isConfigured.current = true;
    }

    return () => {
      wavesurfer?.destroy();
    };
  }, [audioUrl, wavesurfer]);

  return { waveformRef, wavesurfer, isPlaying };
};
