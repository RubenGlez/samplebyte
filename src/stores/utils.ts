export async function withLoading<T>(
  setLoading: (v: boolean) => void,
  action: () => Promise<T>
): Promise<T> {
  setLoading(true)
  try {
    return await action()
  } finally {
    setLoading(false)
  }
}

// Run `worker` over `items` with at most `limit` in flight at once. Used to bound how many audio
// files decode and analyse concurrently during a folder import, so memory and the worker pool
// stay in check instead of firing every file at once.
export async function forEachConcurrent<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      await worker(items[index++])
    }
  })
  await Promise.all(runners)
}
