import { useEffect, useState } from "react";
import Editor from "./components/Editor";
import Loader from "./components/Loader";
import Layout from "./components/Layout";

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [audio, setAudio] = useState({
    name: "",
    size: 0,
    type: "",
    path: "",
  });

  const handleFileLoaded = (file: File) => {
    const { size, type, name } = file;
    const path = URL.createObjectURL(file);
    setAudio({ name, path, size, type });
  };

  const handleDownload = (videoUrl: string) => {
    setIsLoading(true);
    window.api.send("download-mp3", videoUrl);
  };

  useEffect(() => {
    window.api.receive("mp3-downloaded", ({ audioData, metadata }) => {
      const blob = new Blob([audioData as BlobPart], { type: "audio/mp3" });
      const path = URL.createObjectURL(blob);
      const { size, type } = blob;
      setAudio({ name: metadata.title, path, size, type });
      setIsLoading(false);
    });

    window.api.receive("mp3-download-error", (error) => {
      console.log(`something went wrong: ${error}`);
    });
  }, []);

  return (
    <Layout>
      {audio.path ? (
        <Editor
          name={audio.name}
          size={audio.size}
          type={audio.type}
          path={audio.path}
        />
      ) : (
        <Loader
          onFileLoaded={handleFileLoaded}
          onUrlLoaded={handleDownload}
          isLoading={isLoading}
        />
      )}
    </Layout>
  );
}
