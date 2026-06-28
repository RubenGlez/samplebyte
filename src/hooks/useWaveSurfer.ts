import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline";

interface UseWavesurferProps {
  audioUrl: string;
}

const WAVE_HEIGHT = 180;
const CURSOR_COLOR = "rgba(255,255,255,0.9)";

// Vertical gradients give the bars depth instead of reading as flat rectangles. The unplayed wave
// is a quiet warm-grey; the played side (progress) is brighter so the consumed portion is legible
// at a glance. Built once on a throwaway canvas — WaveSurfer accepts a CanvasGradient for color.
function buildWaveColors() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { wave: "#5f5852", progress: "#8a8078" };

  const wave = ctx.createLinearGradient(0, 0, 0, WAVE_HEIGHT);
  wave.addColorStop(0, "#6b6259");
  wave.addColorStop(0.5, "#5a534c");
  wave.addColorStop(1, "#48423d");

  const progress = ctx.createLinearGradient(0, 0, 0, WAVE_HEIGHT);
  progress.addColorStop(0, "#a89b8d");
  progress.addColorStop(0.5, "#8f8478");
  progress.addColorStop(1, "#6f655b");

  return { wave, progress };
}

export const useWavesurfer = ({ audioUrl }: UseWavesurferProps) => {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const [isPlaying, setIsPlaying] = useState(false);
  const isConfigured = useRef(false);

  useEffect(() => {
    // isConfigured guards against a second run of this effect when audioUrl changes — WS is only
    // ever created once per mount. The parent must use key={url} to force a remount on URL changes.
    if (waveformRef.current && !isConfigured.current) {
      const { wave, progress } = buildWaveColors();
      const wsInstance = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: wave,
        progressColor: progress,
        cursorColor: CURSOR_COLOR,
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        hideScrollbar: true,
        autoCenter: false,
        autoplay: false,
        autoScroll: false,
        height: WAVE_HEIGHT,
        plugins: [
          RegionsPlugin.create(),
          TimelinePlugin.create({
            style: {
              color: "rgba(255,255,255,0.25)",
              fontSize: "10px",
              fontFamily: "'SF Mono', Menlo, Monaco, monospace",
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

  useEffect(() => {
    if (!wavesurfer) return;
    const { wave, progress } = buildWaveColors();
    wavesurfer.setOptions({ waveColor: wave, progressColor: progress, cursorColor: CURSOR_COLOR });
  }, [wavesurfer]);

  return { waveformRef, wavesurfer, isPlaying };
};
