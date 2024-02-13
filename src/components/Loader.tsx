import { DragEvent, useState } from "react";
import YouTubeInput from "./YouTubeInput";
import CardRoot from "./Card/CardRoot";

interface LoaderProps {
  onFileLoaded: (file: File) => void;
  onUrlLoaded: (url: string) => void;
  isLoading: boolean;
}

export default function Loader({
  onFileLoaded,
  onUrlLoaded,
  isLoading,
}: LoaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file.type.startsWith("audio/")) {
      onFileLoaded(file);
    }
  };

  return (
    <CardRoot
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-center h-96">
        {isLoading ? (
          <p>loading</p>
        ) : isDragging ? (
          <div className="absolute rounded border-2 border-dashed border-sky-500 top-0 right-0 bottom-0 left-0 bg-sky-500/10 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-base text-center">
              Drop it like it's hot
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h1 className="text-slate-400 text-base text-center font-medium m-0">
              Paste a URL
            </h1>
            <YouTubeInput onSubmit={onUrlLoaded} />
            <h2 className="text-slate-400 text-base text-center font-medium m-0">
              or drop a file
            </h2>
          </div>
        )}
      </div>
    </CardRoot>
  );
}
