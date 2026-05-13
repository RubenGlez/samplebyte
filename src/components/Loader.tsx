import { DragEvent, useState } from 'react'
import { usePlayerStore } from '@/stores/player'
import CardRoot from './Card/CardRoot'

const AUDIO_EXTENSIONS = /\.(wav|mp3|flac|aiff?|ogg|m4a)$/i
const FORMATS = ['WAV', 'MP3', 'FLAC', 'AIFF', 'OGG']

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
    <CardRoot
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="relative flex flex-col items-center justify-center h-72 gap-5">
        {isDragging ? (
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-accent bg-accent/5 flex items-center justify-center pointer-events-none">
            <p className="text-accent text-sm font-medium" style={{ fontFamily: 'var(--font-family-brand)' }}>
              Drop to load
            </p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-raised border border-border-bright flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-sm text-ink font-medium">Drop an audio file here</p>
              <p className="text-xs text-faint">or</p>
              <button
                onClick={handlePickFile}
                className="text-accent hover:text-accent-bright text-xs font-medium underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 transition-colors"
              >
                Browse files
              </button>
            </div>

            <div className="flex items-center gap-2">
              {FORMATS.map((fmt) => (
                <span
                  key={fmt}
                  className="px-2 py-0.5 rounded bg-raised border border-border text-[10px] text-faint"
                  style={{ fontFamily: 'var(--font-family-mono)' }}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </CardRoot>
  )
}
