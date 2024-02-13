import { Region } from "wavesurfer.js/dist/plugins/regions";

interface ExportButtonProps {
  regions?: Region[];
}

export default function ExportButton({ regions = [] }: ExportButtonProps) {
  const showBtn = regions.length > 0;
  const handleClick = () => {
    // TODO
  };

  if (!showBtn) return <></>;

  return (
    <div className="p-8 pt-0">
      <button
        className="bg-white/80 border-0 rounded h-8 w-full text-black text-md font-medium p-0 m-0"
        onClick={handleClick}
      >
        LET'S GO! 🚀
      </button>
    </div>
  );
}
