import { useState, useEffect, useCallback } from "react";

type DownloadedMp3 = {
  audioData: BlobPart;
  metadata: {
    title: string;
  };
};

export const useDownload = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [audio, setAudio] = useState({
    name: "",
    size: 0,
    type: "",
    path: "",
  });

  const handleFileLoaded = useCallback((file: File) => {
    const { size, type, name } = file;
    const path = URL.createObjectURL(file);
    setAudio({ name, path, size, type });
  }, []);

  const handleDownload = useCallback((videoUrl: string) => {
    setIsLoading(true);
    window.api.send("downloadSong", videoUrl);
  }, []);

  useEffect(() => {
    window.api.receive("downloadSongSuccess", (props) => {
      const { audioData, metadata } = props as DownloadedMp3;

      const blob = new Blob([audioData], { type: "audio/mp3" });
      const path = URL.createObjectURL(blob);
      const { size, type } = blob;

      setAudio({ name: metadata.title, path, size, type });
      setIsLoading(false);
    });

    window.api.receive("downloadSongError", (error) => {
      console.log(`something went wrong: ${error}`);
    });
  }, []);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(audio.path);
    };
  }, [audio.path]);

  return {
    audio,
    isLoading,
    handleFileLoaded,
    handleDownload,
  };
};
