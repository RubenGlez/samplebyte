import { ACTIVE_COLOR, INACTIVE_COLOR } from "@/config/constants";
import { getRegionsPlugin } from "@/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

interface UseRegionsProps {
  wavesurfer?: WaveSurfer;
}

const toggleRegionsColor = (regions: Region[] = [], selectedRegion: Region) => {
  regions.forEach((region) => {
    const isSelected = region.id === selectedRegion.id;
    region.setOptions({
      ...region,
      color: isSelected ? ACTIVE_COLOR : INACTIVE_COLOR,
    });
  });
};

export const useRegions = ({ wavesurfer }: UseRegionsProps) => {
  const isConfigured = useRef(false);

  const [selectedRegion, setSelectedRegion] = useState<Region>();

  const regionsPlugin = getRegionsPlugin(wavesurfer);

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

  const onRegionRemoved = useCallback((region: Region) => {}, []);

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
    },
    [handleSelectRegion]
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
          color: ACTIVE_COLOR,
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
};
