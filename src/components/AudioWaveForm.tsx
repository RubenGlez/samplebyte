import { useCallback, useState } from 'react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useLibraryStore } from '@/stores/library'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import SampleList from './SampleList'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
  filePath: string
}

const AudioWaveform = ({ audioUrl, audioName, filePath }: AudioWaveformProps) => {
  const { waveformRef, wavesurfer } = useWavesurfer({ audioUrl })
  const { selectedRegion, regions, handleSelectRegion, updateRegionName } = useRegions({ wavesurfer })
  const { fetchSamples } = useLibraryStore()

  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [projectName, setProjectName] = useState(audioName.replace(/\.[^.]+$/, ''))

  const handleSaveToLibrary = useCallback(async () => {
    if (!regions?.length) return
    setIsSaving(true)
    try {
      await window.api.library.saveChops({
        sourceFilePath: filePath,
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: r.id })),
      })
      await fetchSamples()
    } finally {
      setIsSaving(false)
    }
  }, [filePath, regions, fetchSamples])

  const handleSaveProject = useCallback(async () => {
    if (!projectName.trim() || !regions?.length) return
    setIsSaving(true)
    try {
      await window.api.projects.save({
        name: projectName.trim(),
        sourcePath: filePath,
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: r.id })),
      })
      setShowSaveDialog(false)
    } finally {
      setIsSaving(false)
    }
  }, [filePath, projectName, regions])

  const handleExport = useCallback(async () => {
    if (!regions?.length) return
    const outputDir = await window.api.fs.pickFolder()
    if (!outputDir) return

    setIsExporting(true)
    try {
      const result = await window.api.audio.exportRegions({
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: r.id })),
        sourceFilePath: filePath,
        outputDir,
        profileId: 'generic',
      })
      alert(`Exported ${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} to ${outputDir}`)
    } finally {
      setIsExporting(false)
    }
  }, [filePath, regions])

  useZoom({ waveformRef, wavesurfer })
  useShortcuts({ wavesurfer, selectedRegion })

  const hasRegions = !!regions?.length

  return (
    <>
      <div id="waveform" ref={waveformRef} />

      <SampleList
        samples={regions}
        selectedSample={selectedRegion}
        onClick={handleSelectRegion}
        onNameChange={updateRegionName}
      />

      <div className="p-6 pt-0 flex gap-3 justify-end">
        <Button variant="ghost" size="sm" onClick={handleExport} disabled={isExporting || !hasRegions}>
          {isExporting ? 'Exporting…' : 'Export WAV'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(true)} disabled={!hasRegions}>
          Save Project
        </Button>
        <Button size="sm" onClick={handleSaveToLibrary} disabled={isSaving || !hasRegions}>
          {isSaving ? 'Saving…' : 'Save to Library'}
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogTitle>Save Project</DialogTitle>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveProject()}
            autoFocus
          />
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleSaveProject} disabled={isSaving || !projectName.trim()}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AudioWaveform
