// Receives sliced channel data for a chop region, returns 100 peak amplitude values.
// Channel arrays are transferred (zero-copy) so the main thread must slice first.
self.onmessage = (e: MessageEvent<{ id: string; channels: Float32Array[]; bars: number }>) => {
  const { id, channels, bars } = e.data
  const len = channels[0]?.length ?? 0
  const step = Math.max(1, Math.floor(len / bars))
  const peaks: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const fs = i * step
    const fe = Math.min(fs + step, len)
    for (let c = 0; c < channels.length; c++) {
      const data = channels[c]
      for (let f = fs; f < fe; f++) {
        const v = Math.abs(data[f])
        if (v > peak) peak = v
      }
    }
    peaks.push(peak)
  }

  self.postMessage({ id, peaks })
}
