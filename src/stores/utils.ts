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
