// Worker pool for the CPU-bound audio-analysis DSP. Workers are spawned lazily up to POOL_SIZE and
// each handles one task at a time, pulling the next queued task when it finishes — so a folder
// import can analyse files across several cores while the interactive single-track flow only ever
// has one task in flight (and so costs nothing extra). The channel buffers are transferred (not
// copied) into the worker, so callers must hand over arrays they own. `runOnWorker` is the whole
// public interface; all the scheduling lives behind it.
type Task = {
  message: Record<string, unknown>
  channels: Float32Array[]
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

const POOL_SIZE = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2))
const poolWorkers: Array<{ worker: Worker; current: Task | null }> = []
const taskQueue: Task[] = []

function spawnWorker() {
  const slot: { worker: Worker; current: Task | null } = {
    worker: new Worker(new URL('../workers/audioAnalysis.worker.ts', import.meta.url), { type: 'module' }),
    current: null,
  }
  slot.worker.onmessage = (e: MessageEvent<{ id: string; result?: unknown; error?: string }>) => {
    const task = slot.current
    slot.current = null
    if (task) {
      if (e.data.error) task.reject(new Error(e.data.error))
      else task.resolve(e.data.result)
    }
    pump()
  }
  poolWorkers.push(slot)
  return slot
}

function pump() {
  if (taskQueue.length === 0) return
  let slot = poolWorkers.find((w) => w.current === null)
  if (!slot && poolWorkers.length < POOL_SIZE) slot = spawnWorker()
  if (!slot) return
  const task = taskQueue.shift()!
  slot.current = task
  slot.worker.postMessage(
    { id: crypto.randomUUID(), ...task.message, channels: task.channels },
    task.channels.map((ch) => ch.buffer)
  )
}

export function runOnWorker<T>(message: Record<string, unknown>, channels: Float32Array[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    taskQueue.push({ message, channels, resolve: resolve as (value: unknown) => void, reject })
    pump()
  })
}
