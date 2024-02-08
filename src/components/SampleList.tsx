import { type Region } from "wavesurfer.js/dist/plugins/regions";
import Sample from "./Sample";

interface SampleListProps {
  samples: Region[];
  selectedSample?: Region;
}

const SampleList = ({ samples, selectedSample }: SampleListProps) => {
  return (
    <ul className="list-none flex flex-col gap-4 p-0 m-0">
      {samples.map((sample) => (
        <Sample
          key={sample.id}
          sample={sample}
          isSelected={sample.id === selectedSample?.id}
        />
      ))}
    </ul>
  );
};

export default SampleList;
