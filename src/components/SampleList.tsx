import { type Region } from "wavesurfer.js/dist/plugins/regions";
import Sample from "./Sample";

interface SampleListProps {
  samples?: Region[];
  selectedSample?: Region;
  onClick: (region: Region) => void;
}

const SampleList = ({
  samples = [],
  selectedSample,
  onClick,
}: SampleListProps) => {
  const hasSamples = samples.length > 0;

  return (
    <div className="p-8">
      {hasSamples && (
        <div className="px-4 py-1 flex justify-between">
          <span className="text-xs text-white/40">Name</span>
          <span className="text-xs text-white/40">Duration</span>
        </div>
      )}
      <ul className="list-none flex flex-col m-0 p-0 max-h-48 overflow-y-auto">
        {samples.map((sample, index) => (
          <Sample
            key={sample.id}
            sample={sample}
            isSelected={sample.id === selectedSample?.id}
            index={index}
            onClick={onClick}
          />
        ))}
      </ul>
    </div>
  );
};

export default SampleList;
