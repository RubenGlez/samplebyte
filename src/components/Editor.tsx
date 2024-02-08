import AudioWaveform from "./AudioWaveForm";
// import SampleList from "./SampleList";

interface EditorProps {
  audioPath: string;
}
export default function Editor({ audioPath }: EditorProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-96 border border-solid border-slate-800 border-b-0 rounded-t-md p-8">
        <h1 className="text-slate-400 text-base text-center">File title</h1>
      </div>

      <AudioWaveform audioUrl={audioPath} />

      <div className="w-96 border border-solid border-slate-800 border-t-0 rounded-b-md p-8">
        {/* <SampleList samples={samples} selectedSample={selectedSample} /> */}
      </div>
    </div>
  );
}
