import { useRegions } from "@/hooks/useRegions";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useWavesurfer } from "@/hooks/useWaveSurfer";
import { useZoom } from "@/hooks/useZoom";
import SampleList from "./SampleList";
import Actions from "./Actions";
import { useFileManagement } from "@/hooks/useFileManagement";
import { useCallback } from "react";
import { convertBlobUrlToArrayBuffer } from "@/utils";

interface AudioWaveformProps {
  audioUrl: string;
}

const AudioWaveform = ({ audioUrl }: AudioWaveformProps) => {
  const { waveformRef, wavesurfer } = useWavesurfer({
    audioUrl,
  });

  const { selectedRegion, regions, handleSelectRegion } = useRegions({
    wavesurfer,
  });

  const { saveProject } = useFileManagement();

  const handleSave = useCallback(async () => {
    const song = await convertBlobUrlToArrayBuffer(audioUrl);

    saveProject({
      name: `example_${Date.now()}`,
      regions: [
        ...(regions?.map((region) => ({
          start: region.start,
          end: region.end,
        })) || []),
      ],
      song,
    });
  }, [audioUrl, regions, saveProject]);

  const handleExport = useCallback(() => {}, []);

  useZoom({ waveformRef, wavesurfer });

  useShortcuts({ wavesurfer, selectedRegion });

  return (
    <>
      <div id="waveform" ref={waveformRef} />

      <SampleList
        samples={regions}
        selectedSample={selectedRegion}
        onClick={handleSelectRegion}
      />

      <Actions handleExport={handleExport} handleSave={handleSave} />
    </>
  );
};

export default AudioWaveform;
