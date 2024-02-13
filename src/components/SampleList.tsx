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
  return (
    <ul className="list-none grid grid-cols-2 gap-4 p-8 m-0">
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
  );
};

export default SampleList;
