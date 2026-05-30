import { useEffect, useRef, useState } from 'react'

export function useAudioPlayer(url: string | null, region?: { start: number; end: number } | null) {
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
    if (region) audio.currentTime = region.start
    audio.ontimeupdate = () => {
      if (region && audio.currentTime >= region.end) {
        audio.pause()
        audio.currentTime = region.start
        setIsPlaying(false)
      }
    }
    audio.onended = () => setIsPlaying(false)
    audioRef.current = audio
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        if (audioRef.current === audio) audioRef.current = null
        setIsPlaying(false)
      })
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
