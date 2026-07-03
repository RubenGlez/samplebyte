import { useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface UseShortcutsProps {
  wavesurfer?: WaveSurfer;
  selectedRegion?: Region;
  regions?: Region[];
  // The region Space plays. How it plays (loop vs once) is decided by the caller's loop toggle.
  playTarget?: Region;
  onPlaySelection?: (region: Region) => void;
  onSelectRegion?: (region: Region) => void;
  // When loop mode is on, navigating to a region loops it rather than just moving the playhead.
  loopMode?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useShortcuts = ({
  wavesurfer,
  selectedRegion,
  regions,
  playTarget,
  onPlaySelection,
  onSelectRegion,
  loopMode,
  onUndo,
  onRedo,
}: UseShortcutsProps) => {
  const handlePressBackspace = useCallback(() => {
    selectedRegion?.remove();
  }, [selectedRegion]);
  const handlePressSpace = useCallback(() => {
    if (wavesurfer?.isPlaying()) {
      wavesurfer.pause();
      return;
    }
    if (playTarget) {
      onPlaySelection?.(playTarget);
      return;
    }
    wavesurfer?.playPause();
  }, [wavesurfer, playTarget, onPlaySelection]);
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
      if (loopMode && onPlaySelection) {
        onPlaySelection(targetRegion); // loops the newly focused region (it selects too)
      } else {
        onSelectRegion(targetRegion);
        wavesurfer?.setTime(targetRegion.start);
      }
    },
    [onSelectRegion, onPlaySelection, loopMode, regions, selectedRegion, wavesurfer]
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
      if (key === "Backspace") handlePressBackspace();
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
    handlePressSpace,
    handlePressBackspace,
    handleSelectAdjacentRegion,
    onRedo,
    onUndo,
  ]);
};
