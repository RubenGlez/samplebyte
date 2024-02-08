import { useWavesurfer } from "@wavesurfer/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Regions, { type Region } from "wavesurfer.js/dist/plugins/regions";
import Timeline from "wavesurfer.js/dist/plugins/timeline";

interface AudioWaveformProps {
  audioUrl: string;
}

const ACTIVE_COLOR = "rgba(3,167,255,0.1)";
const INACTIVE_COLOR = "rgba(255,0,0,0.1)";

const toggleActiveRegion = (regions: Region[], active: Region) => {
  regions.forEach((reg) => {
    const isSelected = reg.id === active.id;
    reg.setOptions({
      ...reg,
      color: isSelected ? ACTIVE_COLOR : INACTIVE_COLOR,
    });
  });
};

const AudioWaveform = ({ audioUrl }: AudioWaveformProps) => {
  const [selectedSample, setSelectedSample] = useState<Region | undefined>();
  const prevZoomLevel = useRef(1);
  const waveformRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const regionsPluginRef = useRef(Regions.create());
  const plugins = useMemo(
    () => [
      regionsPluginRef.current,
      Timeline.create({ style: { color: "white" } }),
    ],
    []
  );

  const { isReady, wavesurfer } = useWavesurfer({
    container: waveformRef,
    waveColor: "#1e293b",
    progressColor: "#64748b",
    cursorColor: "#f1f5f9",
    plugins,
    url: audioUrl,
    hideScrollbar: true,
  });

  const onPlayPause = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const handleWheel = useCallback(
    ({ deltaY }: WheelEvent) => {
      const zoomSensitivity = 0.2; // Ajusta para controlar la sensibilidad del zoom
      const newZoomLevel = prevZoomLevel.current - deltaY * zoomSensitivity;
      // Limita el nuevo nivel de zoom para asegurarse de que esté dentro del rango deseado
      const limitedNewZoomLevel = Math.max(1, Math.min(1000, newZoomLevel));
      prevZoomLevel.current = limitedNewZoomLevel;
      wavesurfer?.zoom(limitedNewZoomLevel);
    },
    [wavesurfer]
  );

  const handlePressSpace = useCallback(() => {
    if (selectedSample) {
      if (wavesurfer?.isPlaying()) {
        wavesurfer.pause();
      } else {
        selectedSample.play();
      }
    } else {
      wavesurfer?.playPause();
    }
  }, [selectedSample, wavesurfer]);

  const handlePressEscape = useCallback(() => {
    setSelectedSample(undefined);
  }, []);

  const onRegionClicked = useCallback((region: Region) => {
    const regions = regionsPluginRef.current.getRegions();
    toggleActiveRegion(regions, region);

    setSelectedSample(region);
  }, []);

  const onRegionCreated = useCallback((region: Region) => {
    const regions = regionsPluginRef.current.getRegions();
    toggleActiveRegion(regions, region);

    setSelectedSample(region);
  }, []);

  useEffect(() => {
    if (isReady) {
      const regionsPlugin = regionsPluginRef.current;

      regionsPlugin.enableDragSelection({
        color: ACTIVE_COLOR,
      });

      regionsPlugin.on("region-created", (region) => {
        onRegionCreated(region);
      });

      regionsPlugin.on("region-updated", (region) => {
        // onRegionUpdated(region);
      });

      regionsPlugin.on("region-removed", (region) => {
        // onRegionRemoved(region);
      });

      regionsPlugin.on("region-clicked", (region, e) => {
        e.stopPropagation(); // prevent triggering a click on the waveform
        onRegionClicked(region);
      });

      regionsPlugin.on("region-in", (region) => {
        // onRegionIn(region);
      });

      regionsPlugin.on("region-out", (region) => {
        // onRegionOut(region);
      });
    }
  }, [isReady, onRegionClicked]);

  useEffect(() => {
    const container = containerRef.current;
    container?.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container?.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === " ") handlePressSpace();
      if (key === "Escape") handlePressEscape();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePressEscape, handlePressSpace]);

  return (
    <>
      <div ref={containerRef} className="w-dvw">
        <div ref={waveformRef} />
      </div>

      <div className="w-96 border border-solid border-slate-800 border-y-0 p-8">
        <button>{"<"}</button>
        <button onClick={onPlayPause}>play/pause</button>
        <button>{">"}</button>
      </div>
    </>
  );
};

export default AudioWaveform;
