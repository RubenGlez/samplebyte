import { RefObject, useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseZoomProps {
  wavesurfer?: WaveSurfer;
  waveformRef: RefObject<HTMLDivElement | null>;
}

export const useZoom = ({ wavesurfer, waveformRef }: UseZoomProps) => {
  const prevZoomLevel = useRef<number | null>(null);

  // Initialise zoom level from actual rendered state when audio is ready
  useEffect(() => {
    if (!wavesurfer) return
    const onReady = () => {
      const container = waveformRef.current
      const duration = wavesurfer.getDuration()
      if (container && duration) {
        prevZoomLevel.current = container.clientWidth / duration
      }
    }
    wavesurfer.on('ready', onReady)
    return () => { wavesurfer.un('ready', onReady) }
  }, [wavesurfer, waveformRef])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!wavesurfer) return

      // Horizontal pan when zoomed: trackpad sideways, or Shift+scroll on a mouse wheel
      const panDelta = e.shiftKey ? e.deltaY : e.deltaX
      const isHorizontalGesture = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (isHorizontalGesture && panDelta !== 0) {
        e.preventDefault()
        wavesurfer.setScroll(wavesurfer.getScroll() + panDelta)
        return
      }

      e.preventDefault()

      const container = waveformRef.current
      const duration = wavesurfer.getDuration()
      const minZoom = container && duration ? container.clientWidth / duration : 1

      // Start from actual zoom if not yet set
      if (prevZoomLevel.current === null) prevZoomLevel.current = minZoom

      // Multiplicative step: ~10% per scroll tick, consistent at any zoom level
      const factor = Math.pow(1.001, -e.deltaY)
      const newZoom = Math.max(minZoom, Math.min(1500, prevZoomLevel.current * factor))
      prevZoomLevel.current = newZoom
      wavesurfer.zoom(newZoom)
    },
    [wavesurfer, waveformRef]
  );

  useEffect(() => {
    const container = waveformRef.current;
    container?.addEventListener("wheel", handleWheel, { passive: false });
    return () => { container?.removeEventListener("wheel", handleWheel) };
  }, [handleWheel, waveformRef]);
};
