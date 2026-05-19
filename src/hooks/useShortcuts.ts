import { useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface UseShortcutsProps {
  wavesurfer?: WaveSurfer;
  selectedRegion?: Region;
  regions?: Region[];
  onSelectRegion?: (region: Region) => void;
}

export const useShortcuts = ({
  wavesurfer,
  selectedRegion,
  regions,
  onSelectRegion,
}: UseShortcutsProps) => {
  // const regionsPlugin = getRegionsPlugin(wavesurfer);

  const handlePressTab = useCallback(() => {}, []);
  const handlePressBackspace = useCallback(() => {
    selectedRegion?.remove();
  }, [selectedRegion]);
  const handlePressEnter = useCallback(() => {
    selectedRegion?.play(true);
  }, [selectedRegion]);
  const handlePressEscape = useCallback(() => {}, []);
  const handlePressSpace = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);
  const handleSelectAdjacentRegion = useCallback(
    (direction: -1 | 1) => {
      if (!regions?.length || !onSelectRegion) return;

      const orderedRegions = [...regions].sort((a, b) => a.start - b.start);
      const selectedIndex = selectedRegion
        ? orderedRegions.findIndex((region) => region.id === selectedRegion.id)
        : -1;
      const targetIndex =
        selectedIndex === -1
          ? direction === 1
            ? 0
            : orderedRegions.length - 1
          : Math.min(
              orderedRegions.length - 1,
              Math.max(0, selectedIndex + direction)
            );

      if (targetIndex === selectedIndex) return;
      const targetRegion = orderedRegions[targetIndex];
      onSelectRegion(targetRegion);
      wavesurfer?.setTime(targetRegion.start);
    },
    [onSelectRegion, regions, selectedRegion, wavesurfer]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return

      const key = event.key;
      if (key === " ") { event.preventDefault(); handlePressSpace(); }
      if (key === "Escape") handlePressEscape();
      if (key === "Enter") handlePressEnter();
      if (key === "Backspace") handlePressBackspace();
      if (key === "Tab") handlePressTab();
      if (key === "ArrowLeft") {
        event.preventDefault();
        handleSelectAdjacentRegion(-1);
      }
      if (key === "ArrowRight") {
        event.preventDefault();
        handleSelectAdjacentRegion(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handlePressEscape,
    handlePressSpace,
    handlePressEnter,
    handlePressBackspace,
    handlePressTab,
    handleSelectAdjacentRegion,
  ]);
};
