import { getRegionsPlugin } from '@/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'
import type { ProjectRegion } from '@/types'

interface UseRegionsProps {
  wavesurfer?: WaveSurfer
  initialRegions?: ProjectRegion[]
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

export const useRegions = ({ wavesurfer, initialRegions }: UseRegionsProps) => {
  const isConfigured = useRef(false)
  const [selectedRegion, setSelectedRegion] = useState<Region>()
  const [regionNames, setRegionNames] = useState<Record<string, string>>({})

  const regionsPlugin = getRegionsPlugin(wavesurfer)
  const regions = regionsPlugin?.getRegions()

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
  }, [])

  useEffect(() => {
    // isConfigured ensures region listeners and drag-selection are registered once per WS instance.
    // A new instance (after remount) starts with isConfigured=false so setup runs again cleanly.
    if (wavesurfer && !isConfigured.current) {
      wavesurfer.on('ready', () => {
        if (!regionsPlugin) return

        // Restore saved regions before registering listeners so region-created events don't fire
        if (initialRegions?.length) {
          const nameMap: Record<string, string> = {}
          initialRegions.forEach((saved) => {
            const region = regionsPlugin.addRegion({
              start: saved.start,
              end: saved.end,
              color: 'var(--region-bg)',
            })
            if (saved.name) nameMap[region.id] = saved.name
          })
          setRegionNames(nameMap)
        }

        regionsPlugin.enableDragSelection({ color: 'var(--region-bg)' })

        regionsPlugin.on('region-created', (region) => handleSelectRegion(region))
        regionsPlugin.on('region-updated', (region) => handleSelectRegion(region))
        regionsPlugin.on('region-removed', () => {})
        regionsPlugin.on('region-clicked', (region, e) => {
          e.stopPropagation()
          handleSelectRegion(region)
          wavesurfer?.setTime(region.start)
        })
      })

      isConfigured.current = true
    }

    return () => {
      wavesurfer?.getActivePlugins().forEach((plug) => plug.unAll())
    }
  }, [handleSelectRegion, initialRegions, regionsPlugin, wavesurfer])

  // Replace all regions with a grid derived from detected transient timestamps.
  // Boundaries: 0, ...transients, duration — each adjacent pair becomes one region.
  const autoChop = useCallback((transients: number[], duration: number) => {
    if (!regionsPlugin) return
    regionsPlugin.getRegions().forEach((r) => r.remove())
    setRegionNames({})
    setSelectedRegion(undefined)
    const boundaries = [0, ...transients, duration]
    for (let i = 0; i < boundaries.length - 1; i++) {
      regionsPlugin.addRegion({ start: boundaries[i], end: boundaries[i + 1], color: 'var(--region-bg)' })
    }
  }, [regionsPlugin])

  return {
    selectedRegion,
    regions,
    regionNames,
    handleSelectRegion,
    updateRegionName,
    autoChop,
  }
}
