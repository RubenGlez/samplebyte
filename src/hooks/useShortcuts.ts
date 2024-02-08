import { getRegionsPlugin } from "@/utils";
import { useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseShortcutsProps {
  wavesurfer?: WaveSurfer;
}

export const useShortcuts = ({ wavesurfer }: UseShortcutsProps) => {
  const handlePressTab = useCallback(() => {}, []);
  const handlePressBackspace = useCallback(() => {}, []);
  const handlePressEscape = useCallback(() => {}, []);
  const handlePressEnter = useCallback(() => {}, []);
  const handlePressSpace = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const regionsPlugin = getRegionsPlugin(wavesurfer);

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
