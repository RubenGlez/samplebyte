import { useState, useEffect } from 'react'
import { analyzeAudioUrl } from '@/lib/audioAnalysis'

export function useAudioAnalysis(audioUrl: string | null) {
  const [bpm, setBpm] = useState<number | null>(null)
  const [musicalKey, setMusicalKey] = useState<string | null>(null)
  const [beatPhase, setBeatPhase] = useState<number | null>(null)
  const [loopBars, setLoopBars] = useState<number | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (!audioUrl) {
      setBpm(null)
      setMusicalKey(null)
      setBeatPhase(null)
      setLoopBars(null)
      return
    }

    let cancelled = false
    setIsAnalyzing(true)
    setBpm(null)
    setMusicalKey(null)
    setBeatPhase(null)
    setLoopBars(null)

    analyzeAudioUrl(audioUrl)
      .then((result) => {
        if (cancelled) return
        setBpm(result.bpm)
        setMusicalKey(result.musicalKey)
        setBeatPhase(result.beatPhase)
        setLoopBars(result.loopBars)
      })
      .catch(() => { /* analysis failure is non-fatal */ })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false)
      })

    return () => { cancelled = true }
  }, [audioUrl])

  return { bpm, musicalKey, beatPhase, loopBars, isAnalyzing }
}
