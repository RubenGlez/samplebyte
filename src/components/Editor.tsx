import AudioWaveform from "./AudioWaveform";
import CardHeader from "./Card/CardHeader";
import CardRoot from "./Card/CardRoot";

interface EditorProps {
  name: string;
  size: number;
  type: string;
  path: string;
}

export default function Editor({ name, path, size, type }: EditorProps) {
  return (
    <CardRoot>
      <CardHeader name={name} size={size} type={type} />

      <AudioWaveform audioUrl={path} />
    </CardRoot>
  );
}
