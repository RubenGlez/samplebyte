import { useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface Playable {
  start: number;
  end: number;
  play: (stopAtEnd?: boolean) => void;
}

interface UseShortcutsProps {
  wavesurfer?: WaveSurfer;
  selectedRegion?: Region;
  regions?: Region[];
  // The region or loop candidate that Space (play once) and Enter (play looped) act on.
  playTarget?: Playable;
  onPlayNormal?: (region: Playable) => void;
  onPlayLoop?: (region: Playable) => void;
  onSelectRegion?: (region: Region) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useShortcuts = ({
  wavesurfer,
  selectedRegion,
  regions,
  playTarget,
  onPlayNormal,
  onPlayLoop,
  onSelectRegion,
  onUndo,
  onRedo,
}: UseShortcutsProps) => {
  // const regionsPlugin = getRegionsPlugin(wavesurfer);

  const handlePressTab = useCallback(() => {}, []);
  const handlePressBackspace = useCallback(() => {
    selectedRegion?.remove();
  }, [selectedRegion]);
  const handlePressEnter = useCallback(() => {
    if (!playTarget) return;
    onPlayLoop?.(playTarget);
  }, [playTarget, onPlayLoop]);
  const handlePressEscape = useCallback(() => {}, []);
  const handlePressSpace = useCallback(() => {
    if (wavesurfer?.isPlaying()) {
      wavesurfer.pause();
      return;
    }
    if (playTarget) {
      onPlayNormal?.(playTarget);
      return;
    }
    wavesurfer?.playPause();
  }, [wavesurfer, playTarget, onPlayNormal]);
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
      const isUndoKey = key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey);
      if (isUndoKey) {
        event.preventDefault();
        if (event.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }
      if (key === " ") { event.preventDefault(); handlePressSpace(); }
      if (key === "Escape") handlePressEscape();
      if (key === "Enter") handlePressEnter();
      if (key === "Backspace") handlePressBackspace();
      if (key === "Tab") handlePressTab();
      if (key === "ArrowUp") {
        event.preventDefault();
        handleSelectAdjacentRegion(-1);
      }
      if (key === "ArrowDown") {
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
    onRedo,
    onUndo,
  ]);
};
