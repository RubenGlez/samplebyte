import AudioWaveform from './AudioWaveform'

interface EditorProps {
  name: string
  size: number
  type: string
  path: string
  filePath: string
}

export default function Editor({ name, path, filePath, size, type }: EditorProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AudioWaveform key={path} audioUrl={path} audioName={name} filePath={filePath} size={size} type={type} />
    </div>
  )
}
