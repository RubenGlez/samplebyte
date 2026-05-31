import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Crop, Grid2x2, Pause, Play, Redo2, Repeat, Scissors, Undo2 } from 'lucide-react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTrimRange } from '@/hooks/useTrimRange'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { usePacksStore } from '@/stores/packs'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import CardHeader from './Card/CardHeader'
import SampleList from './SampleList'
import TrimOverlay from './TrimOverlay'
import { detectTransientsFromUrl, findLoopCandidatesFromUrl } from '@/lib/audioAnalysis'
import { remapRegionsForTrim } from '@/lib/remapRegions'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import type { ProjectRegion } from '@/types'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
  filePath: string
  size: number
  type: string
  initialRegions?: ProjectRegion[]
}

const MIN_AUTO_CHOP_REGION_SECONDS = {
  coarse: 1.6,
  medium: 0.8,
  fine: 0.4,
} as const

type Sensitivity = 'coarse' | 'medium' | 'fine'
type GridDivisions = '4' | '8' | '16' | '32'
type ChopMode = Sensitivity | GridDivisions

const GRID_DIVISIONS = ['4', '8', '16', '32'] as const
const LOOP_BAR_OPTIONS = ['1', '2', '4', '8', '16'] as const
type LoopBarCount = typeof LOOP_BAR_OPTIONS[number]

const AudioWaveform = ({ audioUrl, audioName, filePath, size, type, initialRegions }: AudioWaveformProps) => {
  const { activeProject, autosaveActiveRegions, applyLocalTrim } = useProjectsStore()
  const { createPack, setSlot, hardwareProfileId } = usePacksStore()
  const { setView } = useUiStore()
  const { audio, setAudio } = usePlayerStore()
  const { toast } = useToastStore()
  const { bpm, musicalKey, beatPhase, loopBars, isAnalyzing } = useAudioAnalysis(audioUrl)

  const canTrimFile = !!filePath

  const { waveformRef, wavesurfer, isPlaying } = useWavesurfer({ audioUrl })
  const {
    trimIn,
    trimOut,
    trimDuration,
    duration,
    setTrimIn,
    setTrimOut,
    canApplyTrim,
    viewportTick,
  } = useTrimRange(wavesurfer)
  const clearCandidateRegionsRef = useRef<(() => void) | undefined>(undefined)

  const handleCandidateRegionClick = useCallback((start: number, end: number) => {
    setTrimIn(start)
    setTrimOut(end)
    clearCandidateRegionsRef.current?.()
    wavesurfer?.setTime(start)
    toast('Loop selected — trim updated', 'info')
  }, [setTrimIn, setTrimOut, wavesurfer, toast])

  const { selectedRegion, regions, regionNames, handleSelectRegion, updateRegionName, replaceRegions, autoChop, clearAllRegions, addCandidateRegions, clearCandidateRegions, revision } = useRegions({
    wavesurfer,
    initialRegions,
    onCandidateRegionClick: handleCandidateRegionClick,
  })

  clearCandidateRegionsRef.current = clearCandidateRegions
  const [isSaving, setIsSaving] = useState(false)
  const [projectName] = useState(audioName.replace(/\.[^.]+$/, ''))
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sensitivity, setSensitivity] = useState<ChopMode>('medium')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [loopBarCount, setLoopBarCount] = useState<LoopBarCount>('4')
  const [isAutoChopping, setIsAutoChopping] = useState(false)
  const [isLoopSearching, setIsLoopSearching] = useState(false)
  const [isTrimming, setIsTrimming] = useState(false)
  const [showTrimDialog, setShowTrimDialog] = useState(false)
  const historyRef = useRef<ProjectRegion[][]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringHistory = useRef(false)
  const lastHistorySnapshot = useRef('')
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const currentRegions = useCallback(() =>
    (regions ?? []).map((r, index) => ({ id: r.id, start: r.start, end: r.end, name: regionNames[r.id] ?? `Chop ${index + 1}` })),
    [regions, regionNames]
  )

  const autosaveTimer = useRef<number | null>(null)
  const saveStatusTimer = useRef<number | null>(null)
  const lastSavedAt = useRef<number>(0)
  const isFirstAutosave = useRef(true)
  const DEBOUNCE_MS = 1500
  const MAX_WAIT_MS = 5000

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1,
    })
  }, [])

  useEffect(() => {
    if (!regions) return
    const snapshot = currentRegions()
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastHistorySnapshot.current) return

    lastHistorySnapshot.current = serialized
    if (isRestoringHistory.current) {
      isRestoringHistory.current = false
      syncHistoryState()
      return
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(snapshot)
    historyRef.current = nextHistory.slice(-80)
    historyIndexRef.current = historyRef.current.length - 1
    syncHistoryState()
  }, [currentRegions, regions, revision, syncHistoryState])

  const restoreHistory = useCallback((index: number) => {
    const snapshot = historyRef.current[index]
    if (!snapshot) return
    isRestoringHistory.current = true
    historyIndexRef.current = index
    replaceRegions(snapshot)
    syncHistoryState()
  }, [replaceRegions, syncHistoryState])

  const undoRegions = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    restoreHistory(historyIndexRef.current - 1)
  }, [restoreHistory])

  const redoRegions = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    restoreHistory(historyIndexRef.current + 1)
  }, [restoreHistory])

  useEffect(() => {
    if (!filePath || !regions?.length) return
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
        source: audio?.source ?? 'local',
      }).then(() => {
        lastSavedAt.current = Date.now()
        if (!isFirst) {
          setSaveStatus('saved')
          if (saveStatusTimer.current !== null) window.clearTimeout(saveStatusTimer.current)
          saveStatusTimer.current = window.setTimeout(() => setSaveStatus('idle'), 2000)
        }
      }).catch(() => setSaveStatus('idle'))
    }, delay)

    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    }
  }, [audioName, autosaveActiveRegions, currentRegions, filePath, projectName, regions?.length, revision])

  const handleSendToPack = useCallback(async () => {
    if (!regions?.length || !filePath) return
    setIsSaving(true)
    try {
      const project = await autosaveActiveRegions(currentRegions(), {
        name: projectName.trim() || audioName.replace(/\.[^.]+$/, ''),
        sourcePath: filePath,
        sourceName: audioName,
      })
      if (!project) return

      const pack = await createPack(`${project.name} Pack`, hardwareProfileId)
      const chops = (await window.api.projects.getChops(project.id)).slice(0, 16)
      for (const [index, chop] of chops.entries()) {
        await setSlot(index, {
          id: `project-chop:${chop.id}`,
          sourceType: 'project-chop',
          displayName: chop.name,
          sourcePath: project.sourcePath ?? filePath,
          projectId: project.id,
          projectName: project.name,
          projectChopId: chop.id,
          sampleId: null,
          start: chop.start,
          end: chop.end,
          duration: chop.end - chop.start,
          bpm,
          musicalKey,
          tags: [],
          sourceChopUpdatedAt: chop.updatedAt,
        })
      }
      setView('packs')
      toast(`${chops.length} chop${chops.length !== 1 ? 's' : ''} sent to ${pack.name}`)
    } finally {
      setIsSaving(false)
    }
  }, [
    audioName,
    autosaveActiveRegions,
    bpm,
    createPack,
    currentRegions,
    filePath,
    hardwareProfileId,
    musicalKey,
    projectName,
    regions,
    setSlot,
    setView,
    toast,
  ])

  const handleAutoLoop = useCallback(async () => {
    if (!wavesurfer || bpm === null || beatPhase === null) return
    setIsLoopSearching(true)
    try {
      clearCandidateRegions()
      const candidates = await findLoopCandidatesFromUrl(audioUrl, bpm, beatPhase, parseInt(loopBarCount))
      if (candidates.length === 0) {
        toast('No loop candidates found — try a different bar count', 'info')
        return
      }
      addCandidateRegions(candidates)
    } catch {
      toast('Loop search failed', 'error')
    } finally {
      setIsLoopSearching(false)
    }
  }, [audioUrl, bpm, beatPhase, loopBarCount, wavesurfer, addCandidateRegions, clearCandidateRegions, toast])

  const handleAutoChop = useCallback(async () => {
    if (!wavesurfer) return
    clearCandidateRegions()
    setIsAutoChopping(true)
    try {
      const duration = wavesurfer.getDuration()
      if ((GRID_DIVISIONS as readonly string[]).includes(sensitivity)) {
        const n = parseInt(sensitivity)
        const step = (trimOut - trimIn) / n
        let points = Array.from({ length: n - 1 }, (_, i) => trimIn + (i + 1) * step)
        if (snapEnabled && bpm !== null && beatPhase !== null) {
          const sixteenth = (60 / bpm) / 4
          points = points.map((t) => {
            const k = Math.round((t - beatPhase) / sixteenth)
            return beatPhase + k * sixteenth
          })
        }
        const minGap = snapEnabled && bpm !== null ? (60 / bpm) / 8 : 0
        autoChop(points, duration, { start: trimIn, end: trimOut }, minGap)
        toast(`${n} chops created`)
      } else {
        let transients = await detectTransientsFromUrl(audioUrl, sensitivity as Sensitivity)
        if (transients.length === 0) {
          toast('No transients found — try Fine sensitivity', 'info')
          return
        }
        if (snapEnabled && bpm !== null && beatPhase !== null) {
          const sixteenth = (60 / bpm) / 4
          transients = transients.map((t) => {
            const n = Math.round((t - beatPhase) / sixteenth)
            return beatPhase + n * sixteenth
          })
        }
        autoChop(
          transients,
          duration,
          { start: trimIn, end: trimOut },
          MIN_AUTO_CHOP_REGION_SECONDS[sensitivity as Sensitivity]
        )
        const inner = transients.filter((t) => t > trimIn && t < trimOut)
        const count = inner.length + 1
        toast(`${count} chop${count !== 1 ? 's' : ''} created`)
      }
    } catch {
      toast('Auto-chop failed', 'error')
    } finally {
      setIsAutoChopping(false)
    }
  }, [audioUrl, sensitivity, snapEnabled, bpm, beatPhase, wavesurfer, autoChop, clearCandidateRegions, trimIn, trimOut, toast])

  const trimPreview = useMemo(() => {
    if (!regions?.length) return { kept: 0, dropped: 0 }
    const kept = remapRegionsForTrim(regions, regionNames, trimIn, trimOut)
    return { kept: kept.length, dropped: regions.length - kept.length }
  }, [regions, regionNames, trimIn, trimOut])

  const handleApplyTrim = useCallback(async () => {
    if (!canApplyTrim || !filePath) return
    setShowTrimDialog(false)
    setIsTrimming(true)
    try {
      const kept = remapRegionsForTrim(regions ?? [], regionNames, trimIn, trimOut)
      const { filePath: trimmedPath, duration: trimmedDuration } = await window.api.audio.trimSource({
        sourceFilePath: filePath,
        start: trimIn,
        end: trimOut,
      })

      const saved = await autosaveActiveRegions(kept, {
        name: projectName.trim() || audioName.replace(/\.[^.]+$/, ''),
        sourcePath: trimmedPath,
        sourceName: audioName,
      })
      if (saved) lastSavedAt.current = Date.now()

      if (activeProject) {
        applyLocalTrim({ sourcePath: trimmedPath, regions: kept })
      }

      setAudio({
        name: audioName,
        path: toLocalFileUrl(trimmedPath),
        filePath: trimmedPath,
        size: 0,
        type: 'audio/wav',
        source: audio?.source ?? 'local',
        initialRegions: kept,
      })

      const droppedMsg = trimPreview.dropped > 0
        ? ` · ${trimPreview.dropped} chop${trimPreview.dropped !== 1 ? 's' : ''} removed`
        : ''
      toast(`Source trimmed to ${formatTime(trimmedDuration)}${saved ? ' · Saved' : ''}${droppedMsg}`)
    } catch {
      toast('Trim failed', 'error')
    } finally {
      setIsTrimming(false)
    }
  }, [
    activeProject,
    applyLocalTrim,
    audioName,
    autosaveActiveRegions,
    canApplyTrim,
    filePath,
    projectName,
    regionNames,
    regions,
    setAudio,
    toast,
    trimIn,
    trimOut,
    trimPreview.dropped,
  ])

  useZoom({ waveformRef, wavesurfer })
  const playRegion = useCallback((region: { play: (loop?: boolean) => void }) => {
    region.play(true)
  }, [])

  useShortcuts({
    wavesurfer,
    selectedRegion,
    regions,
    onSelectRegion: handleSelectRegion,
    onUndo: undoRegions,
    onRedo: redoRegions,
  })

  const hasRegions = !!regions?.length

  const actions = (
    <>
      {saveStatus !== 'idle' && (
        <span className={cn('flex items-center gap-1 text-[11px] select-none transition-opacity', saveStatus === 'saved' ? 'text-faint/50' : 'text-faint/30')}>
          {saveStatus === 'saved' && <Check size={10} />}
          {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleSendToPack} disabled={isSaving || !hasRegions}>
        <Grid2x2 size={12} />
        Send to Pack
      </Button>
    </>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <CardHeader name={audioName} size={size} type={type} bpm={bpm} musicalKey={musicalKey} loopBars={loopBars} isAnalyzing={isAnalyzing} actions={actions} />

      <div className="relative shrink-0">
        <div id="waveform" ref={waveformRef} />
        {wavesurfer && duration > 0 && (
          <TrimOverlay
            wavesurfer={wavesurfer}
            duration={duration}
            trimIn={trimIn}
            trimOut={trimOut}
            onTrimInChange={setTrimIn}
            onTrimOutChange={setTrimOut}
            viewportTick={viewportTick}
          />
        )}
      </div>

      {/* Transport */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface shrink-0">
        <button
          onClick={() => wavesurfer?.playPause()}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-raised border border-border hover:border-accent/40 hover:text-accent text-muted transition-colors cursor-pointer"
        >
          {isPlaying
            ? <Pause size={11} fill="currentColor" />
            : <Play  size={11} fill="currentColor" className="translate-x-px" />
          }
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Undo region edit (⌘Z)"
            onClick={undoRegions}
            disabled={!historyState.canUndo}
          >
            <Undo2 size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Redo region edit (⇧⌘Z)"
            onClick={redoRegions}
            disabled={!historyState.canRedo}
          >
            <Redo2 size={12} />
          </Button>
        </div>
        <span className="text-[11px] text-faint/70 flex-1 select-none">
          {isPlaying ? 'Playing' : 'Paused'} — scroll to zoom, shift+scroll or swipe sideways to pan
        </span>

        {/* Auto-loop controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
            {LOOP_BAR_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setLoopBarCount(n)}
                className={cn(
                  'text-[11px] px-2 h-[22px] rounded-[4px] transition-all cursor-pointer border-0',
                  loopBarCount === n
                    ? 'bg-[rgba(255,255,255,0.12)] text-ink'
                    : 'text-faint/70 hover:text-muted bg-transparent'
                )}
              >
                {n}b
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoLoop}
            disabled={isLoopSearching || bpm === null}
            title={bpm === null ? 'Waiting for BPM analysis…' : undefined}
          >
            <Repeat size={12} />
            {isLoopSearching ? 'Searching…' : 'Auto-loop'}
          </Button>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Auto-chop controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-[2px] rounded-[6px] bg-[rgba(255,255,255,0.05)]">
            {(['coarse', 'medium', 'fine'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSensitivity(p)}
                className={cn(
                  'text-[11px] px-2.5 h-[22px] rounded-[4px] transition-all cursor-pointer border-0 capitalize',
                  sensitivity === p
                    ? 'bg-[rgba(255,255,255,0.12)] text-ink'
                    : 'text-faint/70 hover:text-muted bg-transparent'
                )}
              >
                {p}
              </button>
            ))}
            <div className="w-px h-3 bg-[rgba(255,255,255,0.1)] mx-1" />
            {GRID_DIVISIONS.map((n) => (
              <button
                key={n}
                onClick={() => setSensitivity(n)}
                className={cn(
                  'text-[11px] px-2 h-[22px] rounded-[4px] transition-all cursor-pointer border-0',
                  sensitivity === n
                    ? 'bg-[rgba(255,255,255,0.12)] text-ink'
                    : 'text-faint/70 hover:text-muted bg-transparent'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSnapEnabled((v) => !v)}
            disabled={bpm === null}
            title={bpm !== null ? `Snap to 1/16 beat grid (${bpm} BPM)` : 'BPM not yet detected'}
            className={cn(
              'h-[28px] w-[28px] flex items-center justify-center rounded-[6px] border transition-all cursor-pointer',
              snapEnabled && bpm !== null
                ? 'bg-[rgba(255,255,255,0.12)] text-ink border-[rgba(255,255,255,0.2)]'
                : 'text-faint/70 hover:text-muted bg-transparent border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]',
              bpm === null && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Grid2x2 size={12} />
          </button>
          <Button variant="outline" size="sm" onClick={handleAutoChop} disabled={isAutoChopping}>
            <Scissors size={12} />
            {isAutoChopping ? 'Chopping…' : 'Auto-chop'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTrimDialog(true)}
            disabled={!canApplyTrim || !canTrimFile || isTrimming}
            title={!canTrimFile ? 'Save file to disk before trimming' : undefined}
          >
            <Crop size={12} />
            {isTrimming ? 'Trimming…' : 'Trim source'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <SampleList
          samples={regions}
          selectedSample={selectedRegion}
          regionNames={regionNames}
          onClick={handleSelectRegion}
          onPlay={playRegion}
          onNameChange={updateRegionName}
          onClearAll={clearAllRegions}
        />
      </div>

      <div className="flex items-center gap-5 px-5 py-2 border-t border-border bg-surface shrink-0">
        {([['Space', 'Play / Pause'], ['Return', 'Play region'], ['⌫', 'Delete region'], ['↑/↓', 'Prev / Next region'], ['⌘Z', 'Undo'], ['⇧⌘Z', 'Redo']] as const).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded-[4px] bg-raised border border-border text-[10px] text-faint/70 leading-none font-mono">
              {key}
            </kbd>
            <span className="text-[11px] text-faint/60 select-none">{label}</span>
          </span>
        ))}
      </div>

      <Dialog open={showTrimDialog} onOpenChange={setShowTrimDialog}>
        <DialogContent>
          <DialogTitle>Trim source</DialogTitle>
          <p className="text-[13px] text-muted m-0 leading-relaxed">
            Replace the current source with <span className="font-mono text-ink">{formatTime(trimIn)}</span>
            {' – '}
            <span className="font-mono text-ink">{formatTime(trimOut)}</span>
            {' '}({formatTime(trimDuration)}). This cannot be undone without re-importing the full song.
          </p>
          {regions && regions.length > 0 && (
            <p className="text-[12px] text-faint m-0">
              {trimPreview.kept} chop{trimPreview.kept !== 1 ? 's' : ''} kept
              {trimPreview.dropped > 0 && ` · ${trimPreview.dropped} removed`}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleApplyTrim} disabled={isTrimming}>
              {isTrimming ? 'Trimming…' : 'Trim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default AudioWaveform
