import cls from "classnames";
import { type Region } from "wavesurfer.js/dist/plugins/regions";

interface SampleProps {
  sample: Region;
  isSelected: boolean;
}
const formatTime = (seconds: number) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(":");

export default function Sample({ sample, isSelected }: SampleProps) {
  return (
    <li
      key={sample.id}
      className={cls({
        "bg-slate-900 rounded p-4 text-slate-300 flex flex-col gap-2": true,
        "bg-slate-700": isSelected,
      })}
    >
      <div>
        <div>
          <p>
            {`Start: ${formatTime(sample.start)} - End: ${formatTime(sample.end)}`}
          </p>
          <p>{`0:00/${formatTime(sample.end - sample.start)}`}</p>
        </div>
        <div>
          <button
            onClick={() => {
              sample.play();
            }}
          >
            play
          </button>
        </div>
      </div>
    </li>
  );
}
