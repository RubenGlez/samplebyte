import { DragEvent, useState } from 'react'
import { usePlayerStore } from '@/stores/player'
import CardRoot from './Card/CardRoot'

const AUDIO_EXTENSIONS = /\.(wav|mp3|flac|aiff?|ogg|m4a)$/i

export default function Loader() {
  const { setAudio } = usePlayerStore()
  const [isDragging, setIsDragging] = useState(false)

  const loadFile = (file: File) => {
    setAudio({
      name: file.name,
      path: URL.createObjectURL(file),
      filePath: file.path,
      size: file.size,
      type: file.type,
    })
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation() }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && AUDIO_EXTENSIONS.test(file.name)) loadFile(file)
  }

  const handlePickFile = async () => {
    const filePath = await window.api.fs.pickFile()
    if (!filePath) return
    setAudio({
      name: filePath.split('/').pop() ?? 'audio',
      path: `local-file://${filePath}`,
      filePath,
      size: 0,
      type: 'audio/*',
    })
  }

  return (
    <CardRoot onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="flex items-center justify-center h-72">
        {isDragging ? (
          <div className="absolute rounded border-2 border-dashed border-sky-500 inset-0 bg-sky-500/10 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-sm">Drop it like it's hot</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 items-center">
            <p className="text-white/40 text-sm font-medium m-0">Drop an audio file here</p>
            <span className="text-white/20 text-xs">or</span>
            <button
              onClick={handlePickFile}
              className="text-sky-400 hover:text-sky-300 text-sm underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
            >
              Browse files
            </button>
            <p className="text-white/20 text-xs m-0">WAV · MP3 · FLAC · AIFF · OGG</p>
          </div>
        )}
      </div>
    </CardRoot>
  )
}
