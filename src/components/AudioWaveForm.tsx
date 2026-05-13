import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import SampleList from './SampleList'
import Actions from './Actions'
import { useCallback, useState } from 'react'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
}

const AudioWaveform = ({ audioUrl, audioName }: AudioWaveformProps) => {
  const { waveformRef, wavesurfer } = useWavesurfer({ audioUrl })
  const { selectedRegion, regions, handleSelectRegion } = useRegions({ wavesurfer })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleSave = useCallback(async () => {
    if (!regions?.length) return

    const name = prompt('Project name:', audioName.replace(/\.[^.]+$/, ''))
    if (!name) return

    setIsSaving(true)
    try {
      await window.api.projects.save({
        name,
        sourcePath: audioUrl.startsWith('blob:') ? null : audioUrl,
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: r.id })),
      })
    } finally {
      setIsSaving(false)
    }
  }, [audioUrl, audioName, regions])

  const handleExport = useCallback(async () => {
    if (!regions?.length) return

    const outputDir = await window.api.fs.pickFolder()
    if (!outputDir) return

    setIsExporting(true)
    try {
      const result = await window.api.audio.exportRegions({
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: r.id })),
        sourceFilePath: audioUrl,
        outputDir,
        profileId: 'generic',
      })
      alert(`Exported ${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} to ${outputDir}`)
    } finally {
      setIsExporting(false)
    }
  }, [audioUrl, regions])

  useZoom({ waveformRef, wavesurfer })
  useShortcuts({ wavesurfer, selectedRegion })

  return (
    <>
      <div id="waveform" ref={waveformRef} />

      <SampleList samples={regions} selectedSample={selectedRegion} onClick={handleSelectRegion} />

      <Actions
        handleExport={handleExport}
        handleSave={handleSave}
        isSaving={isSaving}
        isExporting={isExporting}
      />
    </>
  )
}

export default AudioWaveform
