import { useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface UseShortcutsProps {
  wavesurfer?: WaveSurfer;
  selectedRegion?: Region;
}

export const useShortcuts = ({
  wavesurfer,
  selectedRegion,
}: UseShortcutsProps) => {
  // const regionsPlugin = getRegionsPlugin(wavesurfer);

  const handlePressTab = useCallback(() => {}, []);
  const handlePressBackspace = useCallback(() => {
    selectedRegion?.remove();
  }, [selectedRegion]);
  const handlePressEnter = useCallback(() => {
    selectedRegion?.play();
  }, [selectedRegion]);
  const handlePressEscape = useCallback(() => {}, []);
  const handlePressSpace = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === " ") handlePressSpace();
      if (key === "Escape") handlePressEscape();
      if (key === "Enter") handlePressEnter();
      if (key === "Backspace") handlePressBackspace();
      if (key === "Tab") handlePressTab();
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
  ]);
};
