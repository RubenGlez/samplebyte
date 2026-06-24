// Runs the CPU-bound audio-analysis DSP off the main thread. The main thread decodes audio
// (AudioContext is unavailable here) and posts the raw channel arrays; this worker mixes to
// mono and runs the requested analysis. Channel buffers are transferred (zero-copy), so the
// caller must hand over copies it does not need to keep.
import { analyzeChannels, detectTransients, rankTransients, findLoopCandidates } from '../lib/audioAnalysis.dsp'

type Request =
  | { id: string; kind: 'analyze'; channels: Float32Array[]; sampleRate: number }
  | { id: string; kind: 'transients'; channels: Float32Array[]; sampleRate: number; preset: 'coarse' | 'medium' | 'fine' }
  | { id: string; kind: 'rank'; channels: Float32Array[]; sampleRate: number; minGap: number }
  | { id: string; kind: 'loops'; channels: Float32Array[]; sampleRate: number; bpm: number; beatPhase: number; barCount: number }

self.onmessage = (e: MessageEvent<Request>) => {
  const msg = e.data
  try {
    let result: unknown
    switch (msg.kind) {
      case 'analyze':
        result = analyzeChannels(msg.channels, msg.sampleRate)
        break
      case 'transients':
        result = detectTransients(msg.channels, msg.sampleRate, msg.preset)
        break
      case 'rank':
        result = rankTransients(msg.channels, msg.sampleRate, msg.minGap)
        break
      case 'loops':
        result = findLoopCandidates(msg.channels, msg.sampleRate, msg.bpm, msg.beatPhase, msg.barCount)
        break
    }
    self.postMessage({ id: msg.id, result })
  } catch (error) {
    self.postMessage({ id: msg.id, error: String(error) })
  }
}
