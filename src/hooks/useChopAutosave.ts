import { useCallback, useEffect, useRef, useState } from 'react'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'
import type { Project, ProjectRegion } from '@/types'

const DEBOUNCE_MS = 1500
const MAX_WAIT_MS = 5000

interface UseChopAutosaveProps {
  filePath: string
  regions: Region[] | undefined
  // Bumped by useRegions on every region change; the trigger for a debounced save.
  revision: number
  currentRegions: () => ProjectRegion[]
  projectName: string
  audioName: string
  source: 'local' | 'freesound'
  // Freesound attribution for the current source, persisted onto the project on first save (F24).
  attribution?: { id: string; license: string; author: string } | null
  autosaveActiveRegions: (
    regions: ProjectRegion[],
    fallback: { name: string; sourcePath: string | null; sourceName?: string | null; source?: 'local' | 'freesound'; freesoundId?: string | null; license?: string | null; author?: string | null }
  ) => Promise<Project | null>
}

// Debounced autosave for the active chop session. Saves region edits after a quiet period, but
// forces a save once MAX_WAIT_MS has elapsed since the last one so continuous edits still persist.
// The first run saves silently (no "Saving…/Saved" status); later runs surface the transient status.
// Returns the status for the header plus markSaved() for callers that persist out-of-band (e.g. trim).
export function useChopAutosave({
  filePath,
  regions,
  revision,
  currentRegions,
  projectName,
  audioName,
  source,
  attribution,
  autosaveActiveRegions,
}: UseChopAutosaveProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autosaveTimer = useRef<number | null>(null)
  const saveStatusTimer = useRef<number | null>(null)
  const lastSavedAt = useRef<number>(0)
  const isFirstAutosave = useRef(true)

  const markSaved = useCallback(() => { lastSavedAt.current = Date.now() }, [])

  // Undefined means the regions plugin isn't mounted yet; an empty array is a real, saveable state.
  const regionsReady = regions !== undefined

  useEffect(() => {
    // Only bail when the regions plugin isn't ready yet. An empty array is a real, saveable state —
    // deleting the last chop or "Clear all" must persist, not be dropped (F5). `revision` re-runs
    // this effect on every region edit, including the transition to zero regions.
    if (!filePath || !regionsReady) return
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)

    const isFirst = isFirstAutosave.current
    if (isFirst) isFirstAutosave.current = false

    const elapsed = Date.now() - lastSavedAt.current
    const delay = !isFirst && elapsed >= MAX_WAIT_MS ? 0 : DEBOUNCE_MS

    if (!isFirst) setSaveStatus('saving')

    autosaveTimer.current = window.setTimeout(() => {
      autosaveActiveRegions(currentRegions(), {
        name: projectName.trim() || audioName.replace(/\.[^.]+$/, ''),
        sourcePath: filePath,
        sourceName: audioName,
        source,
        freesoundId: attribution?.id ?? null,
        license: attribution?.license ?? null,
        author: attribution?.author ?? null,
      }).then(() => {
        lastSavedAt.current = Date.now()
        if (!isFirst) {
          setSaveStatus('saved')
          if (saveStatusTimer.current !== null) window.clearTimeout(saveStatusTimer.current)
          saveStatusTimer.current = window.setTimeout(() => setSaveStatus('idle'), 2000)
        }
      }).catch(() => {
        // Surface failures instead of masking them as idle: a failed save (DB error, ffmpeg
        // missing) left edits unpersisted, and the header must not keep implying "Saved" (F12).
        setSaveStatus('error')
      })
    }, delay)

    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    }
  }, [attribution, audioName, autosaveActiveRegions, currentRegions, filePath, projectName, regionsReady, revision, source])

  return { saveStatus, markSaved }
}
