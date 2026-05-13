import { useCallback, useState } from 'react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import SampleList from './SampleList'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
  filePath: string
}

const SHORTCUTS = [
  { key: 'Space', label: 'Play / Pause' },
  { key: 'Enter', label: 'Play region' },
  { key: '⌫',    label: 'Delete region' },
]

const AudioWaveform = ({ audioUrl, audioName, filePath }: AudioWaveformProps) => {
  const { activeProject, saveProject, updateActiveRegions } = useProjectsStore()

  const { waveformRef, wavesurfer } = useWavesurfer({ audioUrl })
  const { selectedRegion, regions, regionNames, handleSelectRegion, updateRegionName } = useRegions({
    wavesurfer,
    initialRegions: activeProject?.regions,
  })
  const { fetchSamples } = useLibraryStore()

  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [projectName, setProjectName] = useState(audioName.replace(/\.[^.]+$/, ''))

  const currentRegions = useCallback(() =>
    (regions ?? []).map((r) => ({ start: r.start, end: r.end, name: regionNames[r.id] ?? '' })),
    [regions, regionNames]
  )

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
      await saveProject({ name: projectName.trim(), sourcePath: filePath, regions: currentRegions() })
      setShowSaveDialog(false)
    } finally {
      setIsSaving(false)
    }
  }, [filePath, projectName, regions, currentRegions, saveProject])

  const handleUpdateProject = useCallback(async () => {
    if (!regions?.length) return
    setIsSaving(true)
    try {
      await updateActiveRegions(currentRegions())
    } finally {
      setIsSaving(false)
    }
  }, [regions, currentRegions, updateActiveRegions])

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
        regionNames={regionNames}
        onClick={handleSelectRegion}
        onNameChange={updateRegionName}
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border mt-1">
        {/* Shortcut hints */}
        <div className="flex items-center gap-3">
          {SHORTCUTS.map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1.5">
              <kbd
                className="px-1.5 py-0.5 rounded bg-raised border border-border-bright text-[10px] text-faint leading-none"
                style={{ fontFamily: 'var(--font-family-mono)' }}
              >
                {key}
              </kbd>
              <span className="text-[10px] text-faint">{label}</span>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={isExporting || !hasRegions}>
            {isExporting ? 'Exporting…' : 'Export WAV'}
          </Button>
          {activeProject ? (
            <Button variant="outline" size="sm" onClick={handleUpdateProject} disabled={isSaving || !hasRegions}>
              {isSaving ? 'Saving…' : 'Update Project'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={!hasRegions}>
              Save Project
            </Button>
          )}
          <Button size="sm" onClick={handleSaveToLibrary} disabled={isSaving || !hasRegions}>
            {isSaving ? 'Saving…' : 'Save to Library'}
          </Button>
        </div>
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
          <div className="flex justify-end gap-2 mt-4">
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
