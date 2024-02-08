import React, { useState } from "react";

interface YouTubeInputProps {
  onSubmit: (url: string) => void;
}

const YouTubeInput = ({ onSubmit }: YouTubeInputProps) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(url);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-row gap-2 items-center relative rounded pr-1 border-white/10  border-solid border bg-transparent"
    >
      <input
        type="text"
        placeholder="YouTube video URL"
        className="h-10 px-4 border-0 text-white text-base flex-1 outline-0 bg-transparent"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="submit"
        className="border-0 bg-white/10 rounded-sm h-8 cursor-pointer text-white/50"
      >
        {"Go!"}
      </button>
    </form>
  );
};

export default YouTubeInput;
