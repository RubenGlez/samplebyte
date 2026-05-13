import { DragEvent, useState } from 'react'
import CardRoot from './Card/CardRoot'

interface LoaderProps {
  onFileLoaded: (file: File) => void
}

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aiff', 'audio/ogg', 'audio/mp4', 'audio/x-aiff']

export default function Loader({ onFileLoaded }: LoaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && (ACCEPTED_TYPES.includes(file.type) || file.name.match(/\.(wav|mp3|flac|aiff?|ogg|m4a)$/i))) {
      onFileLoaded(file)
    }
  }

  const handlePickFile = async () => {
    const filePath = await window.api.fs.pickFile()
    if (!filePath) return

    // Convert native path to a file:// URL for the audio element
    const url = `file://${filePath}`
    const name = filePath.split('/').pop() ?? filePath
    const response = await fetch(url)
    const blob = await response.blob()
    const file = new File([blob], name, { type: blob.type || 'audio/mpeg' })
    onFileLoaded(file)
  }

  return (
    <CardRoot
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-center h-96">
        {isDragging ? (
          <div className="absolute rounded border-2 border-dashed border-sky-500 top-0 right-0 bottom-0 left-0 bg-sky-500/10 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-base text-center">Drop it like it's hot</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center">
            <p className="text-slate-400 text-base text-center font-medium m-0">Drop an audio file here</p>
            <span className="text-slate-600 text-sm">or</span>
            <button
              onClick={handlePickFile}
              className="text-sky-400 hover:text-sky-300 text-sm underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
            >
              Browse files
            </button>
            <p className="text-slate-600 text-xs m-0">WAV · MP3 · FLAC · AIFF · OGG</p>
          </div>
        )}
      </div>
    </CardRoot>
  )
}
