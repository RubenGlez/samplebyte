import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Grid2x2, Pause, Play, Redo2, Undo2 } from 'lucide-react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTrimRange } from '@/hooks/useTrimRange'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { useLoopPlayback } from '@/hooks/useLoopPlayback'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import { usePacksStore } from '@/stores/packs'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog'
import CardHeader from './Card/CardHeader'
import SampleList from './SampleList'
import LoopCandidateList, { type LoopCandidate } from './LoopCandidateList'
import TrimOverlay from './TrimOverlay'
import { ToolSelector, ToolContextBar } from './WaveformTools'
import {
  LOOP_BAR_OPTIONS,
  MIN_HIT_CHOPS,
  DEFAULT_HIT_CHOPS,
  type ChopMethod,
  type LoopBarCount,
  type SliceCount,
  type WaveformTool,
} from './waveformTools.constants'
import { rankTransientsFromUrl, findLoopCandidatesFromUrl } from '@/lib/audioAnalysis'
import { remapRegionsForTrim } from '@/lib/remapRegions'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import type { ProjectRegion } from '@/types'
import type { Region } from 'wavesurfer.js/dist/plugins/regions'

interface AudioWaveformProps {
  audioUrl: string
  audioName: string
  filePath: string
  size: number
  type: string
  initialRegions?: ProjectRegion[]
}

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
  const { playLooping, playOnce } = useLoopPlayback(wavesurfer)

  // Loop candidates surfaced by Auto-loop. Selecting one previews it; "Use" commits it to the trim range.
  const candidateRegionsRef = useRef<Map<string, Region>>(new Map())
  const [loopCandidates, setLoopCandidates] = useState<LoopCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  // Breaks the cycle between the candidate double-click handler (passed into useRegions) and
  // handleUseLoop (which depends on useRegions output).
  const useLoopRef = useRef<(id: string) => void>(() => {})

  const highlightCandidate = useCallback((id: string | null) => {
    candidateRegionsRef.current.forEach((region, regionId) => {
      region.setOptions({ color: regionId === id ? 'var(--loop-candidate-active-bg)' : 'var(--loop-candidate-bg)' })
    })
  }, [])

  const selectCandidate = useCallback((id: string) => {
    setSelectedCandidateId(id)
    highlightCandidate(id)
    const region = candidateRegionsRef.current.get(id)
    if (region) wavesurfer?.setTime(region.start)
  }, [highlightCandidate, wavesurfer])

  // Clicking a loop auditions it: select + start looping. Clicking the one already playing stops
  // it; clicking a different one switches playback (playLooping replaces the active loop bounds, so
  // the previous loop can't hijack playback).
  const handleCandidateClick = useCallback((id: string) => {
    const region = candidateRegionsRef.current.get(id)
    if (!region) return
    if (id === selectedCandidateId && wavesurfer?.isPlaying()) {
      wavesurfer.pause()
      return
    }
    selectCandidate(id)
    playLooping(region)
  }, [selectedCandidateId, wavesurfer, selectCandidate, playLooping])

  const handleCandidateRegionClick = useCallback((region: Region) => {
    handleCandidateClick(region.id)
  }, [handleCandidateClick])

  const handleCandidateRegionDoubleClick = useCallback((region: Region) => {
    useLoopRef.current(region.id)
  }, [])

  const { selectedRegion, regions, regionNames, handleSelectRegion, updateRegionName, replaceRegions, autoChop, clearAllRegions, addCandidateRegions, clearCandidateRegions, revision } = useRegions({
    wavesurfer,
    initialRegions,
    onCandidateRegionClick: handleCandidateRegionClick,
    onCandidateRegionDoubleClick: handleCandidateRegionDoubleClick,
  })

  const clearLoopCandidates = useCallback(() => {
    clearCandidateRegions()
    candidateRegionsRef.current.clear()
    setLoopCandidates([])
    setSelectedCandidateId(null)
  }, [clearCandidateRegions])

  const handleUseLoop = useCallback((id: string) => {
    const region = candidateRegionsRef.current.get(id)
    if (!region) return
    setTrimIn(region.start)
    setTrimOut(region.end)
    wavesurfer?.setTime(region.start)
    clearLoopCandidates()
    setActiveTool('trim')
    toast('Loop selected — trim updated', 'info')
  }, [setTrimIn, setTrimOut, wavesurfer, clearLoopCandidates, toast])
  useLoopRef.current = handleUseLoop

  const handleClearAllRegions = useCallback(() => {
    clearAllRegions()
    candidateRegionsRef.current.clear()
    setLoopCandidates([])
    setSelectedCandidateId(null)
  }, [clearAllRegions])
  const [isSaving, setIsSaving] = useState(false)
  const [projectName] = useState(audioName.replace(/\.[^.]+$/, ''))
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [activeTool, setActiveTool] = useState<WaveformTool | null>(null)
  const [chopMethod, setChopMethod] = useState<ChopMethod>('hits')
  // Quality-ranked onset peaks for the "Detect hits" slider; detected once per source, top-N taken.
  const [rankedPeaks, setRankedPeaks] = useState<Array<{ time: number; strength: number }> | null>(null)
  const [isDetectingHits, setIsDetectingHits] = useState(false)
  const [chopCount, setChopCount] = useState(DEFAULT_HIT_CHOPS)
  const isSlidingRef = useRef(false)
  const [historyCommitTick, setHistoryCommitTick] = useState(0)
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

  const pushHistory = useCallback((snapshot: ProjectRegion[]) => {
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastHistorySnapshot.current) return
    lastHistorySnapshot.current = serialized
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(snapshot)
    historyRef.current = nextHistory.slice(-80)
    historyIndexRef.current = historyRef.current.length - 1
    syncHistoryState()
  }, [syncHistoryState])

  useEffect(() => {
    if (!regions) return
    const snapshot = currentRegions()
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastHistorySnapshot.current) return
    // While dragging the chop-count slider, skip per-tick snapshots without advancing the baseline,
    // so the whole drag collapses into one undo entry recorded on release (via historyCommitTick).
    if (isSlidingRef.current) return

    if (isRestoringHistory.current) {
      isRestoringHistory.current = false
      lastHistorySnapshot.current = serialized
      syncHistoryState()
      return
    }

    pushHistory(snapshot)
  }, [currentRegions, regions, revision, historyCommitTick, syncHistoryState, pushHistory])

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
      clearLoopCandidates()
      const candidates = await findLoopCandidatesFromUrl(audioUrl, bpm, beatPhase, parseInt(loopBarCount))
      if (candidates.length === 0) {
        toast('No loop candidates found — try a different bar count', 'info')
        return
      }
      const created = addCandidateRegions(candidates)
      const map = new Map<string, Region>()
      const list: LoopCandidate[] = created.map((region, i) => {
        map.set(region.id, region)
        return { id: region.id, start: region.start, end: region.end, score: candidates[i].score }
      })
      candidateRegionsRef.current = map
      setLoopCandidates(list)
      if (list[0]) selectCandidate(list[0].id)
    } catch {
      toast('Loop search failed', 'error')
    } finally {
      setIsLoopSearching(false)
    }
  }, [audioUrl, bpm, beatPhase, loopBarCount, wavesurfer, addCandidateRegions, clearLoopCandidates, selectCandidate, toast])

  const snapToGrid = useCallback((points: number[]) => {
    if (!snapEnabled || bpm === null || beatPhase === null) return points
    const sixteenth = (60 / bpm) / 4
    return points.map((t) => beatPhase + Math.round((t - beatPhase) / sixteenth) * sixteenth)
  }, [snapEnabled, bpm, beatPhase])

  // "Equal slices" — divide the trim selection into N even pieces (button-triggered).
  const handleAutoChop = useCallback(() => {
    if (!wavesurfer) return
    clearLoopCandidates()
    setIsAutoChopping(true)
    try {
      const n = parseInt(sliceCount)
      const step = (trimOut - trimIn) / n
      const points = snapToGrid(Array.from({ length: n - 1 }, (_, i) => trimIn + (i + 1) * step))
      const minGap = snapEnabled && bpm !== null ? (60 / bpm) / 8 : 0
      autoChop(points, wavesurfer.getDuration(), { start: trimIn, end: trimOut }, minGap)
      toast(`${n} chops created`)
    } catch {
      toast('Auto-chop failed', 'error')
    } finally {
      setIsAutoChopping(false)
    }
  }, [wavesurfer, sliceCount, snapToGrid, snapEnabled, bpm, autoChop, clearLoopCandidates, trimIn, trimOut, toast])

  // "Detect hits" — quality-ranked peaks within the current trim range, strongest first.
  const peaksInBounds = useMemo(
    () => (rankedPeaks ?? []).filter((p) => p.time > trimIn && p.time < trimOut),
    [rankedPeaks, trimIn, trimOut]
  )
  const maxChops = peaksInBounds.length + 1

  // Detect peaks once when the hits tool is opened (per source; state resets on remount via key={path}).
  useEffect(() => {
    if (activeTool !== 'chop' || chopMethod !== 'hits') return
    if (rankedPeaks !== null || isDetectingHits) return
    let cancelled = false
    setIsDetectingHits(true)
    rankTransientsFromUrl(audioUrl)
      .then((peaks) => { if (!cancelled) setRankedPeaks(peaks) })
      .catch(() => { if (!cancelled) setRankedPeaks([]) })
      .finally(() => { if (!cancelled) setIsDetectingHits(false) })
    return () => { cancelled = true }
  }, [activeTool, chopMethod, audioUrl, rankedPeaks, isDetectingHits])

  // Build N chops from the top (N-1) peaks by strength, ordered in time.
  const applyHitChop = useCallback((count: number) => {
    if (!wavesurfer) return
    clearLoopCandidates()
    const cuts = peaksInBounds.slice(0, Math.max(0, count - 1)).map((p) => p.time)
    const points = snapToGrid(cuts).sort((a, b) => a - b)
    autoChop(points, wavesurfer.getDuration(), { start: trimIn, end: trimOut }, 0.05)
  }, [wavesurfer, peaksInBounds, snapToGrid, autoChop, clearLoopCandidates, trimIn, trimOut])

  const handleChopCountChange = useCallback((count: number) => {
    setChopCount(count)
    applyHitChop(count)
  }, [applyHitChop])

  const handleChopSlideStart = useCallback(() => { isSlidingRef.current = true }, [])
  const handleChopSlideEnd = useCallback(() => {
    isSlidingRef.current = false
    setHistoryCommitTick((t) => t + 1) // force one undo entry for the whole drag
  }, [])

  // Keep the slider value within the available peak count as the trim range changes (only once
  // peaks exist, so it doesn't snap to 1 while detection is still pending).
  useEffect(() => {
    if (rankedPeaks === null) return
    if (chopCount > maxChops) setChopCount(maxChops)
    else if (chopCount < MIN_HIT_CHOPS) setChopCount(MIN_HIT_CHOPS)
  }, [rankedPeaks, maxChops, chopCount])

  // Once peaks are ready for an unchopped source, apply the default count so the slider and waveform
  // agree immediately. Runs once; never clobbers existing chops.
  const didInitialHitChop = useRef(false)
  useEffect(() => {
    if (didInitialHitChop.current) return
    if (activeTool !== 'chop' || chopMethod !== 'hits' || rankedPeaks === null) return
    if (maxChops <= MIN_HIT_CHOPS) return
    didInitialHitChop.current = true
    if (regions && regions.length > 0) return
    const count = Math.min(DEFAULT_HIT_CHOPS, maxChops)
    setChopCount(count)
    applyHitChop(count)
  }, [activeTool, chopMethod, rankedPeaks, maxChops, regions, applyHitChop])

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
  const playRegion = useCallback((region: Region) => {
    playOnce(region)
  }, [playOnce])

  const selectedCandidateRegion = selectedCandidateId ? candidateRegionsRef.current.get(selectedCandidateId) : undefined
  const playTarget = selectedCandidateRegion ?? selectedRegion

  useShortcuts({
    wavesurfer,
    selectedRegion,
    regions,
    playTarget,
    onPlayNormal: playOnce,
    onPlayLoop: playLooping,
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
        {/* Transport — play is the distinct primary control (round, filled) */}
        <button
          onClick={() => wavesurfer?.playPause()}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-raised border border-border hover:border-accent/40 hover:text-accent text-muted transition-colors cursor-pointer"
        >
          {isPlaying
            ? <Pause size={11} fill="currentColor" />
            : <Play  size={11} fill="currentColor" className="translate-x-px" />
          }
        </button>

        <div className="w-px h-5 bg-border" />

        {/* History — shares the toolbar button language */}
        <div className="flex items-center gap-1.5">
          <button
            title="Undo region edit (⌘Z)"
            onClick={undoRegions}
            disabled={!historyState.canUndo}
            className={cn(
              'h-[28px] w-[28px] flex items-center justify-center rounded-[6px] border bg-transparent transition-colors',
              historyState.canUndo
                ? 'text-muted border-border hover:text-ink hover:border-border-bright cursor-pointer'
                : 'text-faint/30 border-border/50 cursor-not-allowed'
            )}
          >
            <Undo2 size={13} />
          </button>
          <button
            title="Redo region edit (⇧⌘Z)"
            onClick={redoRegions}
            disabled={!historyState.canRedo}
            className={cn(
              'h-[28px] w-[28px] flex items-center justify-center rounded-[6px] border bg-transparent transition-colors',
              historyState.canRedo
                ? 'text-muted border-border hover:text-ink hover:border-border-bright cursor-pointer'
                : 'text-faint/30 border-border/50 cursor-not-allowed'
            )}
          >
            <Redo2 size={13} />
          </button>
        </div>
        <div className="flex-1" />

        <div className="w-px h-5 bg-border" />

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
          chopCount,
          maxChops,
          setChopCount: handleChopCountChange,
          onChopSlideStart: handleChopSlideStart,
          onChopSlideEnd: handleChopSlideEnd,
          isDetecting: isDetectingHits,
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
        <LoopCandidateList
          candidates={loopCandidates}
          selectedId={selectedCandidateId}
          playingId={isPlaying ? selectedCandidateId : null}
          onToggle={handleCandidateClick}
          onUse={handleUseLoop}
          onClear={clearLoopCandidates}
        />
        <SampleList
          samples={regions}
          selectedSample={selectedRegion}
          regionNames={regionNames}
          onClick={handleSelectRegion}
          onPlay={playRegion}
          onNameChange={updateRegionName}
          onClearAll={handleClearAllRegions}
        />
      </div>

      <div className="flex items-center gap-5 px-5 py-2 border-t border-border bg-surface shrink-0">
        {([['Space', 'Play once'], ['↵', 'Play loop'], ['⌫', 'Delete region'], ['↑/↓', 'Prev / Next region'], ['⌘Z', 'Undo'], ['⇧⌘Z', 'Redo']] as const).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded-[4px] bg-raised border border-border text-[10px] text-faint/70 leading-none font-mono">
              {key}
            </kbd>
            <span className="text-[11px] text-faint/60 select-none">{label}</span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-faint/50 select-none">
          Scroll to zoom · shift-scroll or swipe to pan
        </span>
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
