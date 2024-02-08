import { useEffect, useMemo, useState } from "react";
import Editor from "./components/Editor";
import Loader from "./components/Loader";
import bgImg from "./assets/1.avif";

export default function App() {
  const [audioPath, setAudioPath] = useState("");

  const handleFileLoaded = (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioPath(url);
  };
  const handleDownload = (videoUrl: string) => {
    window.api.send("download-mp3", videoUrl);
  };

  const style = useMemo(() => ({ backgroundImage: `url(${bgImg})` }), []);

  useEffect(() => {
    window.api.receive("mp3-downloaded", (audioData) => {
      const blob = new Blob([audioData as BlobPart], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      setAudioPath(url);
    });
  }, []);

  return (
    <div
      className="bg-slate-950 h-dvh flex flex-col items-center justify-center bg-no-repeat bg-cover bg-blend-color"
      style={style}
    >
      {audioPath ? (
        <Editor audioPath={audioPath} />
      ) : (
        <Loader onFileLoaded={handleFileLoaded} onUrlLoaded={handleDownload} />
      )}
    </div>
  );
}
