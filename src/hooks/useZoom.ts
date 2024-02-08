import { RefObject, useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseZoomProps {
  wavesurfer?: WaveSurfer;
  waveformRef: RefObject<HTMLDivElement>;
}

export const useZoom = ({ wavesurfer, waveformRef }: UseZoomProps) => {
  const prevZoomLevel = useRef(1);

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

  useEffect(() => {
    const container = waveformRef.current;

    container?.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container?.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, waveformRef]);
};
