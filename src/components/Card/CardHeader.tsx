import { formatBytes, humanizeAudioType } from "@/utils";

interface CardHeaderProps {
  name: string;
  size: number;
  type: string;
}

export default function CardHeader({ name, size, type }: CardHeaderProps) {
  return (
    <div className="flex items-center p-8 gap-8 text-white/40">
      <div className="h-20 min-w-20 bg-white/10 flex items-center justify-center">
        🎧
      </div>
      <div className="flex flex-col">
        <h3 className="line-clamp-1 m-0 text-lg">{name}</h3>
        <p className="m-0 text-sm">{formatBytes(size)}</p>
        <p className="m-0 text-sm">{humanizeAudioType(type)}</p>
      </div>
    </div>
  );
}
