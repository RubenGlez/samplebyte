import { useCallback, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import CardHeader from './Card/CardHeader'
import SampleList from './SampleList'
import { analyzeAudioUrl, detectTransientsFromUrl } from '@/lib/audioAnalysis'
import { cn } from '@/lib/utils'
import type { Sample } from '../../electron/types'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
  filePath: string
  size: number
  type: string
}


const AudioWaveform = ({ audioUrl, audioName, filePath, size, type }: AudioWaveformProps) => {
  const { activeProject, saveProject, updateActiveRegions } = useProjectsStore()
  const { toast } = useToastStore()
  const { bpm, musicalKey, isAnalyzing } = useAudioAnalysis(audioUrl)

  const { waveformRef, wavesurfer, isPlaying } = useWavesurfer({ audioUrl })
  const { selectedRegion, regions, regionNames, handleSelectRegion, updateRegionName, autoChop } = useRegions({
    wavesurfer,
    initialRegions: activeProject?.regions,
  })
  const { fetchSamples, updateSample } = useLibraryStore()

  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [projectName, setProjectName] = useState(audioName.replace(/\.[^.]+$/, ''))
  const [sensitivity, setSensitivity] = useState<'coarse' | 'medium' | 'fine'>('medium')
  const [isAutoChopping, setIsAutoChopping] = useState(false)

  const currentRegions = useCallback(() =>
    (regions ?? []).map((r) => ({ start: r.start, end: r.end, name: regionNames[r.id] ?? '' })),
    [regions, regionNames]
  )

  const analyzeAndPersist = useCallback(async (saved: Sample[]) => {
    for (const sample of saved) {
      try {
        const result = await analyzeAudioUrl(`local-file://${sample.filePath}`)
        await updateSample(sample.id, result)
      } catch { /* non-fatal */ }
    }
  }, [updateSample])

  const handleSaveToLibrary = useCallback(async () => {
    if (!regions?.length) return
    setIsSaving(true)
    try {
      const saved = await window.api.library.saveChops({
        sourceFilePath: filePath,
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: regionNames[r.id] ?? '' })),
        projectId: activeProject?.id,
      })
      await fetchSamples()
      toast(`${regions.length} chop${regions.length !== 1 ? 's' : ''} saved to Library`)
      analyzeAndPersist(saved)
    } finally {
      setIsSaving(false)
    }
  }, [filePath, regions, regionNames, fetchSamples, toast, analyzeAndPersist])

  const handleSaveProject = useCallback(async () => {
    if (!projectName.trim() || !regions?.length) return
    setIsSaving(true)
    try {
      await saveProject({ name: projectName.trim(), sourcePath: filePath, regions: currentRegions() })
      setShowSaveDialog(false)
      toast('Project saved')
    } finally {
      setIsSaving(false)
    }
  }, [filePath, projectName, regions, currentRegions, saveProject, toast])

  const handleUpdateProject = useCallback(async () => {
    if (!regions?.length) return
    setIsSaving(true)
    try {
      await updateActiveRegions(currentRegions())
      toast('Project updated')
    } finally {
      setIsSaving(false)
    }
  }, [regions, currentRegions, updateActiveRegions, toast])

  const handleExport = useCallback(async () => {
    if (!regions?.length) return
    const outputDir = await window.api.fs.pickFolder()
    if (!outputDir) return

    setIsExporting(true)
    try {
      const result = await window.api.audio.exportRegions({
        regions: regions.map((r) => ({ start: r.start, end: r.end, name: regionNames[r.id] ?? r.id })),
        sourceFilePath: filePath,
        outputDir,
        profileId: 'generic',
      })
      toast(`${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} exported`)
    } finally {
      setIsExporting(false)
    }
  }, [filePath, regions, regionNames, toast])

  const handleAutoChop = useCallback(async () => {
    if (!wavesurfer) return
    setIsAutoChopping(true)
    try {
      const transients = await detectTransientsFromUrl(audioUrl, sensitivity)
      if (transients.length === 0) {
        toast('No transients found — try Fine sensitivity', 'info')
        return
      }
      autoChop(transients, wavesurfer.getDuration())
      const count = transients.length + 1
      toast(`${count} chop${count !== 1 ? 's' : ''} created`)
    } catch {
      toast('Auto-chop failed', 'error')
    } finally {
      setIsAutoChopping(false)
    }
  }, [audioUrl, sensitivity, wavesurfer, autoChop, toast])

  useZoom({ waveformRef, wavesurfer })
  useShortcuts({ wavesurfer, selectedRegion })

  const hasRegions = !!regions?.length

  const actions = (
    <>
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
    </>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <CardHeader name={audioName} size={size} type={type} bpm={bpm} musicalKey={musicalKey} isAnalyzing={isAnalyzing} actions={actions} />

      <div id="waveform" ref={waveformRef} className="shrink-0" />

      {/* Transport */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border shrink-0">
        <button
          onClick={() => wavesurfer?.playPause()}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-raised border border-border-bright hover:border-accent/40 hover:text-accent text-muted transition-colors cursor-pointer bg-transparent"
        >
          {isPlaying
            ? <Pause size={11} fill="currentColor" />
            : <Play  size={11} fill="currentColor" className="translate-x-px" />
          }
        </button>
        <span className="text-[10px] text-faint font-mono flex-1">
          {isPlaying ? 'Playing' : 'Paused'} · scroll to zoom
        </span>

        {/* Auto-chop controls */}
        <div className="flex items-center gap-1.5">
          {(['coarse', 'medium', 'fine'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSensitivity(p)}
              className={cn(
                'text-[10px] px-2 h-5 rounded border transition-colors cursor-pointer bg-transparent capitalize font-brand',
                sensitivity === p
                  ? 'border-accent/40 text-accent bg-accent/10'
                  : 'border-border text-faint hover:text-muted hover:border-border-bright'
              )}
            >
              {p}
            </button>
          ))}
          <Button size="sm" onClick={handleAutoChop} disabled={isAutoChopping}>
            {isAutoChopping ? 'Chopping…' : 'Auto-chop'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <SampleList
          samples={regions}
          selectedSample={selectedRegion}
          regionNames={regionNames}
          onClick={handleSelectRegion}
          onNameChange={updateRegionName}
        />
      </div>

      <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border shrink-0">
        {([['Space', 'Play / Pause'], ['Enter', 'Play region'], ['⌫', 'Delete region']] as const).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-raised border border-border-bright text-[10px] text-faint leading-none font-mono">
              {key}
            </kbd>
            <span className="text-[10px] text-faint">{label}</span>
          </span>
        ))}
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
    </div>
  )
}

export default AudioWaveform
