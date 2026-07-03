import { create } from 'zustand'
import { usePlayerStore, type AudioSource } from './player'
import { toLocalFileUrl } from '@/utils'
import type { StemFile, StemName } from '@/types'

type StemChannels = { left: Float32Array; right: Float32Array }
type StemSet = Record<StemName, StemChannels>
type WorkerMsg =
  | { type: 'ready' }
  | { type: 'progress'; value: number }
  | { type: 'result'; stems: StemSet }
  | { type: 'error'; message: string }

const STEM_LABELS: Record<StemName, string> = {
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
  vocals: 'Vocals',
}
export const STEM_ORDER: StemName[] = ['drums', 'bass', 'other', 'vocals']
export const stemLabel = (name: StemName) => STEM_LABELS[name]

type Status = 'idle' | 'loading-model' | 'decoding' | 'separating' | 'persisting' | 'done' | 'error'

type StemsState = {
  status: Status
  progress: number // 0..1
  error: string | null
  stems: StemFile[] | null
  selected: StemName | null
  sourceHash: string | null
  originalSource: AudioSource | null
  separate: (source: AudioSource) => Promise<void>
  selectStem: (name: StemName) => void
  restoreOriginal: () => void
  cancel: () => void
  reset: () => void
}

// One worker for the session; the 84MB model stays loaded across separations. Terminated on cancel.
let worker: Worker | null = null
let readyPromise: Promise<void> | null = null
let onProgress: ((v: number) => void) | null = null
let pendingResult: { resolve: (s: StemSet) => void; reject: (e: Error) => void } | null = null
// Monotonic run token. Each separate() run claims one; a superseding run or cancel() bumps it so a
// stale run's post-await steps no-op instead of clobbering shared state or the UI (F8).
let activeRunId = 0

// The demucs build is a 32-bit-heap Emscripten module; a very long track (in + 4 stems out + model)
// overruns it and aborts with no useful message. Cap up front with a clear error instead.
const MAX_STEM_SECONDS = 10 * 60

function disposeWorker() {
  worker?.terminate()
  worker = null
  readyPromise = null
  // Never leave an awaiting separate() hanging on a promise that can no longer settle (F8).
  pendingResult?.reject(new Error('stem separation cancelled'))
  pendingResult = null
  onProgress = null
}

function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  // IPC-delivered bytes are backed by a plain (non-shared) ArrayBuffer.
  const buf = u.buffer as ArrayBuffer
  return u.byteOffset === 0 && u.byteLength === buf.byteLength
    ? buf
    : buf.slice(u.byteOffset, u.byteOffset + u.byteLength)
}

// Lazily create the worker and load the vendored model into it. Resolves once the model is ready.
async function ensureWorker(): Promise<Worker> {
  if (worker && readyPromise) {
    await readyPromise
    return worker
  }
  const [jsBytes, wasmBytes, dataBytes] = await Promise.all([
    window.api.stems.getModelFile('demucs.js'),
    window.api.stems.getModelFile('demucs.wasm'),
    window.api.stems.getModelFile('demucs.data'),
  ])
  const w = new Worker(new URL('../workers/stemSeparation.worker.ts', import.meta.url), { type: 'module' })
  worker = w
  w.onmessage = (e: MessageEvent<WorkerMsg>) => {
    const msg = e.data
    if (msg.type === 'progress') onProgress?.(msg.value)
    else if (msg.type === 'result') pendingResult?.resolve(msg.stems)
    else if (msg.type === 'error') pendingResult?.reject(new Error(msg.message))
  }

  readyPromise = new Promise<void>((resolve, reject) => {
    const onReady = (e: MessageEvent<WorkerMsg>) => {
      if (e.data.type === 'ready') {
        w.removeEventListener('message', onReady)
        resolve()
      } else if (e.data.type === 'error') {
        w.removeEventListener('message', onReady)
        reject(new Error(e.data.message))
      }
    }
    w.addEventListener('message', onReady)
    const wasmBinary = toArrayBuffer(wasmBytes)
    const dataBuffer = toArrayBuffer(dataBytes)
    w.postMessage(
      { type: 'init', jsText: new TextDecoder().decode(jsBytes), wasmBinary, dataBuffer },
      [wasmBinary, dataBuffer]
    )
  })
  await readyPromise
  return w
}

async function decodeToStereo(bytes: ArrayBuffer): Promise<{ left: Float32Array; right: Float32Array }> {
  const ctx = new OfflineAudioContext(2, 1, 44100)
  const buf = await ctx.decodeAudioData(bytes.slice(0))
  const left = buf.getChannelData(0)
  const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)
  return { left: left.slice(), right: right.slice() }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const useStemsStore = create<StemsState>((set, get) => ({
  status: 'idle',
  progress: 0,
  error: null,
  stems: null,
  selected: null,
  sourceHash: null,
  originalSource: null,

  separate: async (source) => {
    // Claim a run token. Any earlier in-flight run is superseded: reset the worker so its late
    // result can't cross-wire into this run, which also rejects that run's pending promise.
    const runId = ++activeRunId
    if (pendingResult || worker) disposeWorker()
    const superseded = () => activeRunId !== runId

    set({ status: 'decoding', progress: 0, error: null, stems: null, selected: null, originalSource: source })
    try {
      const bytes = await (await fetch(source.path)).arrayBuffer()
      const sourceHash = await sha256Hex(bytes)
      if (superseded()) return
      set({ sourceHash })

      const cached = await window.api.stems.getCached(sourceHash)
      if (superseded()) return
      if (cached) {
        set({ status: 'done', progress: 1, stems: cached })
        return
      }

      set({ status: 'loading-model' })
      const w = await ensureWorker()
      if (superseded()) return

      set({ status: 'decoding' })
      const { left, right } = await decodeToStereo(bytes)
      if (superseded()) return

      if (left.length / 44100 > MAX_STEM_SECONDS) {
        throw new Error(`Track is too long to separate (max ${MAX_STEM_SECONDS / 60} minutes)`)
      }

      set({ status: 'separating', progress: 0.02 })
      onProgress = (v) => { if (!superseded()) set({ progress: Math.max(0.02, v) }) }
      const stemSet = await new Promise<StemSet>((resolve, reject) => {
        pendingResult = { resolve, reject }
        w.postMessage({ type: 'separate', left, right }, [left.buffer, right.buffer])
      })
      onProgress = null
      pendingResult = null
      if (superseded()) return

      set({ status: 'persisting', progress: 1 })
      const pcm = STEM_ORDER.map((name) => ({
        name,
        sampleRate: 44100,
        left: stemSet[name].left,
        right: stemSet[name].right,
      }))
      const files = await window.api.stems.persist(
        sourceHash,
        pcm,
      )
      if (superseded()) return
      set({ status: 'done', stems: files })
    } catch (err) {
      // A superseded/cancelled run rejecting is expected — don't surface it as an error over the
      // run that replaced it.
      if (!superseded()) set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },

  selectStem: (name) => {
    const { stems, originalSource } = get()
    const file = stems?.find((s) => s.name === name)
    if (!file || !originalSource) return
    const stemSource: AudioSource = {
      name: `${originalSource.name} — ${stemLabel(name)}`,
      path: toLocalFileUrl(file.filePath),
      filePath: file.filePath,
      size: 0,
      type: 'audio/wav',
      source: 'local',
    }
    set({ selected: name })
    usePlayerStore.getState().setAudio(stemSource)
  },

  restoreOriginal: () => {
    const { originalSource } = get()
    if (!originalSource) return
    set({ selected: null })
    usePlayerStore.getState().setAudio(originalSource)
  },

  cancel: () => {
    // Invalidate the in-flight run first so its rejected promise is treated as cancellation, then
    // tear down the worker (which rejects the pending result so separate() stops awaiting).
    activeRunId++
    disposeWorker()
    set({ status: 'idle', progress: 0, error: null })
  },

  reset: () => {
    set({ status: 'idle', progress: 0, error: null, stems: null, selected: null, sourceHash: null, originalSource: null })
  },
}))
