import { formatTime } from "@/utils";
import cls from "classnames";
import { type Region } from "wavesurfer.js/dist/plugins/regions";

interface SampleProps {
  sample: Region;
  isSelected: boolean;
  index: number;
  onClick: (region: Region) => void;
}

export default function Sample({
  sample,
  isSelected,
  index,
  onClick,
}: SampleProps) {
  const duration = sample.end - sample.start;
  const handleClick = () => {
    onClick(sample);
  };

  return (
    <li
      key={sample.id}
      className={cls({
        "py-2 px-4 flex flex-row items-center justify-between gap-2 text-white/40 border border-solid border-white/10 border-b-0 border-x-0 last:border-b cursor-pointer":
          true,
        "bg-white/5": isSelected,
      })}
      onClick={handleClick}
    >
      <span className="m-0 text-md font-medium">{`Sample ${index + 1}`}</span>
      <span className="m-0 text-sm">{formatTime(duration)}</span>
    </li>
  );
}
