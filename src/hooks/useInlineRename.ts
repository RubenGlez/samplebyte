import { useEffect, useRef, useState } from 'react'

export function useInlineRename(name: string, onRename: (name: string) => void) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraftName(name)
      // Defer select so the input is mounted and focusable
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, name])

  const startRename = () => setIsRenaming(true)

  const commitRename = () => {
    setIsRenaming(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
  }

  const cancelRename = () => setIsRenaming(false)

  return { isRenaming, draftName, inputRef, setDraftName, startRename, commitRename, cancelRename }
}
