import { getRegionsPlugin } from "@/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface UseRegionsProps {
  wavesurfer?: WaveSurfer;
}

const REGION_ACTIVE_ID = "region-active";
const REGION_HANDLE_ACTIVE_ID = "region-handle-active";

const toggleRegionsColor = (regions: Region[] = [], selectedRegion: Region) => {
  regions.forEach((region) => {
    const isSelected = region.id === selectedRegion.id;
    const handles = region.element.querySelectorAll('[part*="region-handle"]');
    if (isSelected) {
      region.element.part.add(REGION_ACTIVE_ID);
      handles.forEach((handle) => {
        handle.part.add(REGION_HANDLE_ACTIVE_ID);
      });
    } else {
      region.element.part.remove(REGION_ACTIVE_ID);
      handles.forEach((handle) => {
        handle.part.remove(REGION_HANDLE_ACTIVE_ID);
      });
    }
  });
};

export const useRegions = ({ wavesurfer }: UseRegionsProps) => {
  const isConfigured = useRef(false);

  const [selectedRegion, setSelectedRegion] = useState<Region>();

  const regionsPlugin = getRegionsPlugin(wavesurfer);

  const regions = regionsPlugin?.getRegions();

  const handleSelectRegion = useCallback(
    (region: Region) => {
      const currentRegions = regionsPlugin?.getRegions();
      setSelectedRegion(region);
      toggleRegionsColor(currentRegions, region);
    },
    [regionsPlugin]
  );

  const onRegionCreated = useCallback(
    (region: Region) => {
      handleSelectRegion(region);
    },
    [handleSelectRegion]
  );

  const onRegionRemoved = useCallback(() => {}, []);

  const onRegionUpdated = useCallback(
    (region: Region) => {
      handleSelectRegion(region);
    },
    [handleSelectRegion]
  );

  const onRegionClicked = useCallback(
    (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      handleSelectRegion(region);
      wavesurfer?.setTime(region.start);
    },
    [handleSelectRegion, wavesurfer]
  );

  const onRegionIn = useCallback(() => {}, []);

  const onRegionOut = useCallback(() => {}, []);

  useEffect(() => {
    if (wavesurfer && !isConfigured.current) {
      // On Ready
      wavesurfer.on("ready", () => {
        if (!regionsPlugin) return;

        // Configuration
        regionsPlugin.enableDragSelection({
          color: "var(--region-bg)",
        });

        // Event listeners
        regionsPlugin.on("region-created", onRegionCreated);
        regionsPlugin.on("region-updated", onRegionUpdated);
        regionsPlugin.on("region-removed", onRegionRemoved);
        regionsPlugin.on("region-clicked", onRegionClicked);
        regionsPlugin.on("region-in", onRegionIn);
        regionsPlugin.on("region-out", onRegionOut);
      });

      isConfigured.current = true;
    }

    return () => {
      wavesurfer?.getActivePlugins().forEach((plug) => plug.unAll());
    };
  }, [
    onRegionClicked,
    onRegionCreated,
    onRegionIn,
    onRegionOut,
    onRegionRemoved,
    onRegionUpdated,
    regionsPlugin,
    wavesurfer,
  ]);

  return {
    selectedRegion,
    regions,
    handleSelectRegion,
  };
};
