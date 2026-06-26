/// <reference lib="webworker" />
// Stem separation worker: runs the vendored demucs WASM (4-source) off the UI thread.
//
// The demucs Emscripten build is loaded at runtime from text (it ships as a UMD factory, not an ES
// module) and instantiated with the .wasm and .data bytes provided directly — so the worker never
// fetches anything. The build reports progress and logs by calling the global `postMessage`; we
// intercept that to forward only progress, and use a saved reference for our own protocol.

type StemChannels = { left: Float32Array; right: Float32Array }
type StemSet = { drums: StemChannels; bass: StemChannels; other: StemChannels; vocals: StemChannels }

type InitMsg = { type: 'init'; jsText: string; wasmBinary: ArrayBuffer; dataBuffer: ArrayBuffer }
type SeparateMsg = { type: 'separate'; left: Float32Array; right: Float32Array }
type InMsg = InitMsg | SeparateMsg

type DemucsModule = {
  _malloc: (n: number) => number
  _free: (p: number) => void
  _modelInit: () => void
  _modelDemixSegment: (...args: number[]) => void
  HEAPF32: Float32Array
}

// Saved before we override the global postMessage below.
const post = self.postMessage.bind(self) as (msg: unknown, transfer?: Transferable[]) => void
let mod: DemucsModule | null = null

// demucs calls the global postMessage with { msg: 'PROGRESS_UPDATE', data: 0..1 } during inference
// (plus { msg: 'WASM_LOG', ... }). Forward inference progress; drop the rest.
;(self as unknown as { postMessage: (d: unknown) => void }).postMessage = (data: unknown) => {
  const m = data as { msg?: string; data?: number } | null
  if (m && m.msg === 'PROGRESS_UPDATE' && typeof m.data === 'number') {
    post({ type: 'progress', value: m.data })
  }
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const data = e.data
  try {
    if (data.type === 'init') {
      // Vendored demucs UMD factory, loaded as text by design (defines a global `libdemucs`).
      ;(0, eval)(data.jsText)
      const factory = (globalThis as unknown as { libdemucs?: (arg: object) => Promise<DemucsModule> }).libdemucs
      if (!factory) throw new Error('demucs factory not found after load')
      mod = await factory({
        wasmBinary: data.wasmBinary,
        getPreloadedPackage: () => data.dataBuffer,
        locateFile: (p: string) => p,
      })
      mod._modelInit()
      post({ type: 'ready' })
    } else if (data.type === 'separate') {
      if (!mod) throw new Error('worker not initialized')
      const stems = separate(mod, data.left, data.right)
      const transfer = Object.values(stems).flatMap((s) => [s.left.buffer, s.right.buffer])
      post({ type: 'result', stems }, transfer)
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

// Replicates the demucs.cpp WASM call protocol: copy the stereo input into wasm memory, allocate
// 8 output buffers (4 stems x 2 channels, slot order drums/bass/other/vocals), run inference, copy
// the results out. The whole signal is passed in one call; the model does internal overlap-add.
function separate(m: DemucsModule, left: Float32Array, right: Float32Array): StemSet {
  const n = Math.min(left.length, right.length)
  const BPE = 4
  const inL = m._malloc(n * BPE)
  const inR = m._malloc(n * BPE)
  m.HEAPF32.set(left.subarray(0, n), inL / BPE)
  m.HEAPF32.set(right.subarray(0, n), inR / BPE)

  const out: number[] = []
  for (let i = 0; i < 8; i++) out.push(m._malloc(n * BPE))

  m._modelDemixSegment(inL, inR, n, out[0], out[1], out[2], out[3], out[4], out[5], out[6], out[7], 0)

  // Re-read HEAPF32 in case wasm memory grew during inference, then copy each output out.
  const heap = m.HEAPF32
  const read = (ptr: number) => new Float32Array(heap.buffer, ptr, n).slice()
  const stems: StemSet = {
    drums: { left: read(out[0]), right: read(out[1]) },
    bass: { left: read(out[2]), right: read(out[3]) },
    other: { left: read(out[4]), right: read(out[5]) },
    vocals: { left: read(out[6]), right: read(out[7]) },
  }

  ;[inL, inR, ...out].forEach((p) => m._free(p))
  return stems
}
