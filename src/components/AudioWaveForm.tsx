import { useRegions } from "@/hooks/useRegions";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useWavesurfer } from "@/hooks/useWaveSurfer";
import { useZoom } from "@/hooks/useZoom";
import SampleList from "./SampleList";
import ExportButton from "./ExportButton";

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

      <ExportButton regions={regions} />
    </>
  );
};

export default AudioWaveform;
