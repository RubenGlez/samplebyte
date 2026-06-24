import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Grid2x2, Pause, Play, Redo2, Undo2 } from 'lucide-react'
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
import { ToolSelector, ToolContextBar } from './WaveformTools'
import {
  LOOP_BAR_OPTIONS,
  type ChopMethod,
  type HitSensitivity,
  type LoopBarCount,
  type SliceCount,
  type WaveformTool,
} from './waveformTools.constants'
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

const MIN_AUTO_CHOP_REGION_SECONDS: Record<HitSensitivity, number> = {
  coarse: 1.6,
  medium: 0.8,
  fine: 0.4,
} as const

const AudioWaveform = ({ audioUrl, audioName, filePath, size, type, initialRegions }: AudioWaveformProps) => {
  const { activeProject, autosaveActiveRegions, applyLocalTrim } = useProjectsStore()
  const { createPack, setSlot, hardwareProfileId } = usePacksStore()
  const { setView } = useUiStore()
  const { audio, setAudio } = usePlayerStore()
  const { toast } = useToastStore()
  const { bpm, musicalKey, beatPhase, loopBars, isAnalyzing } = useAudioAnalysis(audioUrl)
  const source = audio?.source ?? 'local'

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
    setActiveTool('trim')
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
  const [activeTool, setActiveTool] = useState<WaveformTool | null>(null)
  const [chopMethod, setChopMethod] = useState<ChopMethod>('hits')
  const [hitSensitivity, setHitSensitivity] = useState<HitSensitivity>('medium')
  const [sliceCount, setSliceCount] = useState<SliceCount>('8')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [loopBarCount, setLoopBarCount] = useState<LoopBarCount>('4')
  const loopBarsTouched = useRef(false)
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
        source,
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
  }, [audioName, autosaveActiveRegions, currentRegions, filePath, projectName, regions?.length, revision, source])

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

  // Default the loop length to the detected bar count, until the user picks one.
  useEffect(() => {
    if (loopBarsTouched.current || loopBars === null) return
    const match = LOOP_BAR_OPTIONS.find((n) => Number(n) === loopBars)
    if (match) setLoopBarCount(match)
  }, [loopBars])

  const handleSelectTool = useCallback((tool: WaveformTool) => {
    setActiveTool((current) => (current === tool ? null : tool))
  }, [])

  const handleSetLoopBarCount = useCallback((n: LoopBarCount) => {
    loopBarsTouched.current = true
    setLoopBarCount(n)
  }, [])

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
      if (chopMethod === 'slices') {
        const n = parseInt(sliceCount)
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
        let transients = await detectTransientsFromUrl(audioUrl, hitSensitivity)
        if (transients.length === 0) {
          toast('No hits found — try the Many setting', 'info')
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
          MIN_AUTO_CHOP_REGION_SECONDS[hitSensitivity]
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
  }, [audioUrl, chopMethod, hitSensitivity, sliceCount, snapEnabled, bpm, beatPhase, wavesurfer, autoChop, clearCandidateRegions, trimIn, trimOut, toast])

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
        source,
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
    source,
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
        {wavesurfer && duration > 0 && activeTool === 'trim' && (
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

        <ToolSelector activeTool={activeTool} onSelectTool={handleSelectTool} />
      </div>

      <ToolContextBar
        activeTool={activeTool}
        loop={{
          barCount: loopBarCount,
          setBarCount: handleSetLoopBarCount,
          suggestedBars: loopBars,
          onFindLoops: handleAutoLoop,
          isSearching: isLoopSearching,
          bpmReady: bpm !== null,
        }}
        chop={{
          method: chopMethod,
          setMethod: setChopMethod,
          sensitivity: hitSensitivity,
          setSensitivity: setHitSensitivity,
          sliceCount,
          setSliceCount,
          snapEnabled,
          setSnapEnabled,
          onChop: handleAutoChop,
          isChopping: isAutoChopping,
          bpmReady: bpm !== null,
        }}
        trim={{
          trimIn,
          trimOut,
          trimDuration,
          onTrim: () => setShowTrimDialog(true),
          canApplyTrim,
          canTrimFile,
          isTrimming,
        }}
      />

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
