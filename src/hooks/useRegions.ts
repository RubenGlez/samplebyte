import { getRegionsPlugin } from '@/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'
import type { ProjectRegion } from '@/types'
import { useUiStore } from '@/stores/ui'

interface UseRegionsProps {
  wavesurfer?: WaveSurfer
  initialRegions?: ProjectRegion[]
  onCandidateRegionClick?: (region: Region) => void
  onCandidateRegionDoubleClick?: (region: Region) => void
}

const REGION_ACTIVE_ID = 'region-active'
const REGION_HANDLE_ACTIVE_ID = 'region-handle-active'

const toggleRegionsColor = (regions: Region[] = [], selectedRegion: Region) => {
  regions.forEach((region) => {
    if (!region.element) return
    const isSelected = region.id === selectedRegion.id
    const handles = region.element.querySelectorAll('[part*="region-handle"]')
    if (isSelected) {
      region.element.part.add(REGION_ACTIVE_ID)
      handles.forEach((h) => h.part.add(REGION_HANDLE_ACTIVE_ID))
    } else {
      region.element.part.remove(REGION_ACTIVE_ID)
      handles.forEach((h) => h.part.remove(REGION_HANDLE_ACTIVE_ID))
    }
  })
}

export const useRegions = ({ wavesurfer, initialRegions, onCandidateRegionClick, onCandidateRegionDoubleClick }: UseRegionsProps) => {
  const isConfigured = useRef(false)
  const initialRegionsRef = useRef(initialRegions)
  const isBulkUpdating = useRef(false)
  const candidateIdsRef = useRef<Set<string>>(new Set())
  const onCandidateRegionClickRef = useRef(onCandidateRegionClick)
  onCandidateRegionClickRef.current = onCandidateRegionClick
  const onCandidateRegionDoubleClickRef = useRef(onCandidateRegionDoubleClick)
  onCandidateRegionDoubleClickRef.current = onCandidateRegionDoubleClick

  const [selectedRegion, setSelectedRegion] = useState<Region>()
  const [regionNames, setRegionNames] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)

  const regionsPlugin = getRegionsPlugin(wavesurfer)
  // Exclude candidate regions from the chop region list
  const regions = regionsPlugin?.getRegions().filter(r => !candidateIdsRef.current.has(r.id))

  const handleSelectRegion = useCallback(
    (region: Region) => {
      const currentRegions = regionsPlugin?.getRegions()
      setSelectedRegion(region)
      toggleRegionsColor(currentRegions, region)
    },
    [regionsPlugin]
  )

  const updateRegionName = useCallback((regionId: string, name: string) => {
    setRegionNames((prev) => ({ ...prev, [regionId]: name }))
    setRevision((value) => value + 1)
  }, [])

  const replaceRegions = useCallback((nextRegions: ProjectRegion[]) => {
    if (!regionsPlugin) return
    isBulkUpdating.current = true
    regionsPlugin.clearRegions()
    const nameMap: Record<string, string> = {}
    const restored: Region[] = []
    nextRegions.forEach((saved) => {
      const region = regionsPlugin.addRegion({
        id: saved.id,
        start: saved.start,
        end: saved.end,
        color: 'var(--region-bg)',
      })
      restored.push(region)
      if (saved.name) nameMap[region.id] = saved.name
    })
    setRegionNames(nameMap)
    setSelectedRegion(restored[0])
    if (restored[0]) toggleRegionsColor(restored, restored[0])
    isBulkUpdating.current = false
    setRevision((value) => value + 1)
  }, [regionsPlugin])

  useEffect(() => {
    // isConfigured ensures region listeners and drag-selection are registered once per WS instance.
    // A new instance (after remount) starts with isConfigured=false so setup runs again cleanly.
    if (wavesurfer && !isConfigured.current) {
      wavesurfer.on('ready', () => {
        if (!regionsPlugin) return

        // Restore saved regions before registering listeners so region-created events don't fire
        if (initialRegionsRef.current?.length) {
          const nameMap: Record<string, string> = {}
          const restored: Region[] = []
          initialRegionsRef.current.forEach((saved) => {
            const region = regionsPlugin.addRegion({
              id: saved.id,
              start: saved.start,
              end: saved.end,
              color: 'var(--region-bg)',
            })
            restored.push(region)
            if (saved.name) nameMap[region.id] = saved.name
          })
          setRegionNames(nameMap)

          const { pendingFocusStart, setPendingFocusStart } = useUiStore.getState()
          if (pendingFocusStart !== null) {
            const match = restored.find((r) => Math.abs(r.start - pendingFocusStart) < 0.01)
            if (match) {
              setSelectedRegion(match)
              toggleRegionsColor(restored, match)
            }
            setPendingFocusStart(null)
          }
        }

        regionsPlugin.enableDragSelection({ color: 'var(--region-bg)' })

        regionsPlugin.on('region-created', (region) => {
          if (isBulkUpdating.current) return
          if (candidateIdsRef.current.has(region.id)) return
          handleSelectRegion(region)
          setRevision((value) => value + 1)
        })
        regionsPlugin.on('region-updated', (region) => {
          if (isBulkUpdating.current) return
          if (candidateIdsRef.current.has(region.id)) return
          handleSelectRegion(region)
          setRevision((value) => value + 1)
        })
        regionsPlugin.on('region-removed', () => {
          if (isBulkUpdating.current) return
          setRevision((value) => value + 1)
        })
        regionsPlugin.on('region-clicked', (region, e) => {
          e.stopPropagation()
          if (candidateIdsRef.current.has(region.id)) {
            onCandidateRegionClickRef.current?.(region)
            return
          }
          handleSelectRegion(region)
          wavesurfer?.setTime(region.start)
        })
        regionsPlugin.on('region-double-clicked', (region, e) => {
          e.stopPropagation()
          if (candidateIdsRef.current.has(region.id)) {
            onCandidateRegionDoubleClickRef.current?.(region)
          }
        })
      })

      isConfigured.current = true
    }

    return () => {
      wavesurfer?.getActivePlugins().forEach((plug) => plug.unAll())
    }
  }, [handleSelectRegion, regionsPlugin, wavesurfer])

  const clearAllRegions = useCallback(() => {
    if (!regionsPlugin) return
    regionsPlugin.clearRegions()
    candidateIdsRef.current.clear()
    setRegionNames({})
    setSelectedRegion(undefined)
    setRevision((value) => value + 1)
    wavesurfer?.pause()
  }, [regionsPlugin, wavesurfer])

  const addCandidateRegions = useCallback((candidates: Array<{ start: number; end: number }>): Region[] => {
    if (!regionsPlugin) return []
    isBulkUpdating.current = true
    const created: Region[] = []
    for (const c of candidates) {
      const region = regionsPlugin.addRegion({
        start: c.start,
        end: c.end,
        color: 'var(--loop-candidate-bg)',
        drag: false,
        resize: false,
      })
      candidateIdsRef.current.add(region.id)
      created.push(region)
    }
    isBulkUpdating.current = false
    setRevision((v) => v + 1)
    return created
  }, [regionsPlugin])

  const clearCandidateRegions = useCallback(() => {
    if (!regionsPlugin) return
    isBulkUpdating.current = true
    for (const id of candidateIdsRef.current) {
      const region = regionsPlugin.getRegions().find(r => r.id === id)
      region?.remove()
    }
    candidateIdsRef.current.clear()
    isBulkUpdating.current = false
    setRevision((v) => v + 1)
  }, [regionsPlugin])

  // Replace all regions with a grid derived from detected transient timestamps.
  // Boundaries: 0, ...transients, duration — each adjacent pair becomes one region.
  const autoChop = useCallback((
    transients: number[],
    duration: number,
    bounds?: { start: number; end: number },
    minRegionSeconds = 0.4
  ) => {
    if (!regionsPlugin) return
    clearAllRegions()
    const start = bounds?.start ?? 0
    const end = bounds?.end ?? duration
    const inner: number[] = []
    let previous = start
    for (const transient of transients) {
      if (transient <= start || transient >= end) continue
      if (transient - previous < minRegionSeconds) continue
      if (end - transient < minRegionSeconds) continue
      inner.push(transient)
      previous = transient
    }
    const boundaries = [start, ...inner, end]
    for (let i = 0; i < boundaries.length - 1; i++) {
      regionsPlugin.addRegion({ start: boundaries[i], end: boundaries[i + 1], color: 'var(--region-bg)' })
    }
  }, [regionsPlugin, clearAllRegions])

  return {
    selectedRegion,
    regions,
    regionNames,
    handleSelectRegion,
    updateRegionName,
    replaceRegions,
    autoChop,
    clearAllRegions,
    addCandidateRegions,
    clearCandidateRegions,
    revision,
  }
}
