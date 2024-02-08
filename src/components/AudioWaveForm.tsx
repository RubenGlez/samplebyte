import { useRegions } from "@/hooks/useRegions";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useWavesurfer } from "@/hooks/useWaveSurfer";
import { useZoom } from "@/hooks/useZoom";

interface AudioWaveformProps {
  audioUrl: string;
}

const AudioWaveform = ({ audioUrl }: AudioWaveformProps) => {
  const { waveformRef, wavesurfer } = useWavesurfer({
    audioUrl,
  });

  useRegions({ wavesurfer });

  useZoom({ waveformRef, wavesurfer });

  useShortcuts({ wavesurfer });

  return <div ref={waveformRef} className="w-dvw" />;
};

export default AudioWaveform;
