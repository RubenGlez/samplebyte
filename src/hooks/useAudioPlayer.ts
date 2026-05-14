import { useEffect, useRef, useState } from 'react'

export function useAudioPlayer(url: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Stop and clean up audio when the component using this hook unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const play = () => {
    if (!url) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    const audio = new Audio(url)
    audio.onended = () => setIsPlaying(false)
    audio.play()
    audioRef.current = audio
    setIsPlaying(true)
  }

  const stop = () => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
  }

  const toggle = () => (isPlaying ? stop() : play())

  return { isPlaying, play, stop, toggle }
}
