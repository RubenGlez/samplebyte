import { useCallback, useEffect, useRef, useState } from 'react'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'
import type { ProjectRegion } from '@/types'

// Cap on retained undo states; older snapshots are dropped once exceeded.
const MAX_HISTORY = 80

interface UseChopHistoryProps {
  regions: Region[] | undefined
  // Bumped by useRegions on every region create/update/remove; the deliberate trigger for snapshots.
  revision: number
  // Produces the current regions as a serialisable snapshot.
  currentRegions: () => ProjectRegion[]
  // Restores a snapshot back onto the waveform.
  replaceRegions: (snapshot: ProjectRegion[]) => void
}

// Undo/redo for chop regions. Owns the snapshot stack and its one tricky invariant: while the
// chop-count slider is dragged, per-tick region changes are coalesced into a single undo entry
// recorded on release (beginSliderEdit/endSliderEdit) rather than one entry per pixel.
export function useChopHistory({ regions, revision, currentRegions, replaceRegions }: UseChopHistoryProps) {
  const historyRef = useRef<ProjectRegion[][]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringHistory = useRef(false)
  const lastHistorySnapshot = useRef('')
  const isSlidingRef = useRef(false)
  const [commitTick, setCommitTick] = useState(0)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1,
    })
  }, [])

  const pushHistory = useCallback((snapshot: ProjectRegion[]) => {
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastHistorySnapshot.current) return
    lastHistorySnapshot.current = serialized
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(snapshot)
    historyRef.current = nextHistory.slice(-MAX_HISTORY)
    historyIndexRef.current = historyRef.current.length - 1
    syncHistoryState()
  }, [syncHistoryState])

  useEffect(() => {
    if (!regions) return
    const snapshot = currentRegions()
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastHistorySnapshot.current) return
    // While dragging the chop-count slider, skip per-tick snapshots without advancing the baseline,
    // so the whole drag collapses into one undo entry recorded on release (via commitTick).
    if (isSlidingRef.current) return

    if (isRestoringHistory.current) {
      isRestoringHistory.current = false
      lastHistorySnapshot.current = serialized
      syncHistoryState()
      return
    }

    pushHistory(snapshot)
  }, [currentRegions, regions, revision, commitTick, syncHistoryState, pushHistory])

  const restoreHistory = useCallback((index: number) => {
    const snapshot = historyRef.current[index]
    if (!snapshot) return
    isRestoringHistory.current = true
    historyIndexRef.current = index
    replaceRegions(snapshot)
    syncHistoryState()
  }, [replaceRegions, syncHistoryState])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    restoreHistory(historyIndexRef.current - 1)
  }, [restoreHistory])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    restoreHistory(historyIndexRef.current + 1)
  }, [restoreHistory])

  const beginSliderEdit = useCallback(() => { isSlidingRef.current = true }, [])
  const endSliderEdit = useCallback(() => {
    isSlidingRef.current = false
    setCommitTick((t) => t + 1) // force one undo entry for the whole drag
  }, [])

  return {
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    undo,
    redo,
    beginSliderEdit,
    endSliderEdit,
  }
}
