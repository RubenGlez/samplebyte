import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Grid2x2, Pause, Play, Redo2, Repeat, Undo2 } from 'lucide-react'
import { useRegions } from '@/hooks/useRegions'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTrimRange } from '@/hooks/useTrimRange'
import { useWavesurfer } from '@/hooks/useWaveSurfer'
import { useZoom } from '@/hooks/useZoom'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { useLoopPlayback } from '@/hooks/useLoopPlayback'
import { useChopHistory } from '@/hooks/useChopHistory'
import { useChopAutosave } from '@/hooks/useChopAutosave'
import { usePlayerStore } from '@/stores/player'
import { useStemsStore } from '@/stores/stems'
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
import { rankTransientsFromUrl, findLoopCandidatesFromUrl, type RankedPeak } from '@/lib/audioAnalysis'
import { remapRegionsForTrim } from '@/lib/remapRegions'
import { cn } from '@/lib/utils'
import { formatTime, toLocalFileUrl } from '@/utils'
import type { ProjectRegion, StemName } from '@/types'
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
  const stemsState = useStemsStore()
  const { toast } = useToastStore()
  const [savingStemToLibrary, setSavingStemToLibrary] = useState(false)
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
  const { playLooping, playOnce, stopLoop } = useLoopPlayback(wavesurfer)
  // Loop mode: when on, playing/clicking a region repeats it; when off, plays once.
  const [loopMode, setLoopMode] = useState(false)
  const regionClickRef = useRef<(region: Region) => void>(() => {})

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
    onRegionClick: useCallback((region: Region) => regionClickRef.current(region), []),
  })

  // Play a region honouring the loop toggle (selects it first so it stays the play target).
  const playRegionWithMode = useCallback((region: Region) => {
    handleSelectRegion(region)
    if (loopMode) playLooping(region)
    else playOnce(region)
  }, [handleSelectRegion, loopMode, playLooping, playOnce])

  // Clicking a region: in loop mode it auditions on repeat (clicking the playing one stops it); in
  // normal mode it just selects and moves the playhead.
  const handleRegionClick = useCallback((region: Region) => {
    if (loopMode) {
      if (selectedRegion?.id === region.id && wavesurfer?.isPlaying()) {
        wavesurfer.pause()
        return
      }
      handleSelectRegion(region)
      playLooping(region)
    } else {
      handleSelectRegion(region)
      wavesurfer?.setTime(region.start)
    }
  }, [loopMode, selectedRegion, wavesurfer, handleSelectRegion, playLooping])
  regionClickRef.current = handleRegionClick

  const handleToggleLoop = useCallback(() => {
    setLoopMode((prev) => {
      if (prev) { stopLoop(); wavesurfer?.pause() } // turning off stops the current loop
      return !prev
    })
  }, [stopLoop, wavesurfer])

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
  // Selecting a stem swaps the source, which remounts this component (key={audio.path}). Re-open the
  // Stems panel when the freshly-mounted source is this run's original or one of its stems, so the
  // picker stays put for previewing instead of collapsing on every selection.
  const [activeTool, setActiveTool] = useState<WaveformTool | null>(() => {
    const s = useStemsStore.getState()
    const isStemView =
      s.status === 'done' &&
      (s.originalSource?.filePath === filePath || !!s.stems?.some((st) => st.filePath === filePath))
    return isStemView ? 'stems' : null
  })
  const [chopMethod, setChopMethod] = useState<ChopMethod>('hits')
  // Quality-ranked chop fragments for the "Detect hits" slider; detected once per source, top-N taken.
  const [rankedPeaks, setRankedPeaks] = useState<RankedPeak[] | null>(null)
  const [isDetectingHits, setIsDetectingHits] = useState(false)
  const [chopCount, setChopCount] = useState(DEFAULT_HIT_CHOPS)
  const [sliceCount, setSliceCount] = useState<SliceCount>('8')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [loopBarCount, setLoopBarCount] = useState<LoopBarCount>('4')
  const loopBarsTouched = useRef(false)
  const [isAutoChopping, setIsAutoChopping] = useState(false)
  const [isLoopSearching, setIsLoopSearching] = useState(false)
  const [isTrimming, setIsTrimming] = useState(false)
  const [showTrimDialog, setShowTrimDialog] = useState(false)

  const currentRegions = useCallback(() =>
    (regions ?? []).map((r, index) => ({ id: r.id, start: r.start, end: r.end, name: regionNames[r.id] ?? `Chop ${index + 1}` })),
    [regions, regionNames]
  )

  const { canUndo, canRedo, undo, redo, beginSliderEdit, endSliderEdit } = useChopHistory({
    regions,
    revision,
    currentRegions,
    replaceRegions,
  })

  const { saveStatus, markSaved } = useChopAutosave({
    filePath,
    regions,
    revision,
    currentRegions,
    projectName,
    audioName,
    source,
    autosaveActiveRegions,
  })

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

  // Snap times to the beat grid. subdivisionsPerBeat=4 → 1/16 note (tight, for slices);
  // subdivisionsPerBeat=1 → whole beat (for phrase-length chop starts).
  const snapToGrid = useCallback((points: number[], subdivisionsPerBeat: number) => {
    if (!snapEnabled || bpm === null || beatPhase === null) return points
    const step = (60 / bpm) / subdivisionsPerBeat
    return points.map((t) => beatPhase + Math.round((t - beatPhase) / step) * step)
  }, [snapEnabled, bpm, beatPhase])

  // "Equal slices" — divide the trim selection into N even pieces (button-triggered).
  const handleAutoChop = useCallback(() => {
    if (!wavesurfer) return
    clearLoopCandidates()
    setIsAutoChopping(true)
    try {
      const n = parseInt(sliceCount)
      const step = (trimOut - trimIn) / n
      const points = snapToGrid(Array.from({ length: n - 1 }, (_, i) => trimIn + (i + 1) * step), 4)
      const minGap = snapEnabled && bpm !== null ? (60 / bpm) / 8 : 0
      autoChop(points, wavesurfer.getDuration(), { start: trimIn, end: trimOut }, minGap)
      toast(`${n} chops created`)
    } catch {
      toast('Auto-chop failed', 'error')
    } finally {
      setIsAutoChopping(false)
    }
  }, [wavesurfer, sliceCount, snapToGrid, snapEnabled, bpm, autoChop, clearLoopCandidates, trimIn, trimOut, toast])

  // "Detect hits" — quality-ranked chop fragments whose onset falls within the trim range, strongest
  // first. Each fragment is itself one chop, so the slider max is the fragment count (no +1 boundaries).
  const peaksInBounds = useMemo(
    () => (rankedPeaks ?? []).filter((p) => p.start >= trimIn && p.start < trimOut),
    [rankedPeaks, trimIn, trimOut]
  )
  const maxChops = peaksInBounds.length

  // Detect peaks once when the hits tool is opened (per source; state resets on remount via key={path}).
  // hitDetectionRef guards against re-dispatch. Crucially, isDetectingHits is NOT a dependency: setting
  // it here would otherwise re-run this effect and fire its own cleanup (cancelled=true) before the
  // worker resolves, discarding the result and leaving detection stuck forever.
  const hitDetectionRef = useRef(false)
  useEffect(() => {
    if (activeTool !== 'chop' || chopMethod !== 'hits') return
    if (rankedPeaks !== null || hitDetectionRef.current) return
    hitDetectionRef.current = true
    let cancelled = false
    setIsDetectingHits(true)
    rankTransientsFromUrl(audioUrl)
      .then((peaks) => { if (!cancelled) setRankedPeaks(peaks) })
      .catch(() => { if (!cancelled) setRankedPeaks([]) })
      .finally(() => { if (!cancelled) setIsDetectingHits(false) })
    return () => { cancelled = true }
  }, [activeTool, chopMethod, audioUrl, rankedPeaks])

  // Lay down the top-N strongest fragments as discrete chops. Each carries its organic 2–5s in/out;
  // we clamp to the trim range, optionally beat-align the in, and cap each end at the next selected
  // chop's start so they never overlap (gaps remain wherever a fragment ends before the next begins).
  const applyHitChop = useCallback((count: number) => {
    clearLoopCandidates()
    const chosen = [...peaksInBounds].slice(0, count).sort((a, b) => a.start - b.start)
    const fragments: ProjectRegion[] = chosen
      .map((f, i) => {
        let start = Math.max(f.start, trimIn)
        if (snapEnabled) {
          const [snapped] = snapToGrid([start], 1)
          if (snapped >= trimIn) start = snapped
        }
        const nextStart = i + 1 < chosen.length ? chosen[i + 1].start : Infinity
        const end = Math.min(f.end, trimOut, nextStart)
        return { start, end }
      })
      .filter((f) => f.end > f.start)
      .map((f, i) => ({ start: f.start, end: f.end, name: `Chop ${String(i + 1).padStart(2, '0')}` }))
    replaceRegions(fragments)
  }, [peaksInBounds, snapEnabled, snapToGrid, replaceRegions, clearLoopCandidates, trimIn, trimOut])

  const handleChopCountChange = useCallback((count: number) => {
    setChopCount(count)
    applyHitChop(count)
  }, [applyHitChop])

  // Detect hits is live, so toggling Snap must re-apply the current chop immediately rather than
  // waiting for the next slider move. Skips the first run (mount) and only fires on a real toggle.
  const snapInitRef = useRef(true)
  useEffect(() => {
    if (snapInitRef.current) { snapInitRef.current = false; return }
    if (activeTool !== 'chop' || chopMethod !== 'hits') return
    if (rankedPeaks === null || maxChops < MIN_HIT_CHOPS) return
    applyHitChop(chopCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-apply on a Snap toggle
  }, [snapEnabled])

  // Keep the slider value within the available fragment count as the trim range changes (only once
  // peaks exist and there is at least one fragment, so it doesn't oscillate or snap while pending).
  useEffect(() => {
    if (rankedPeaks === null || maxChops < MIN_HIT_CHOPS) return
    if (chopCount > maxChops) setChopCount(maxChops)
    else if (chopCount < MIN_HIT_CHOPS) setChopCount(MIN_HIT_CHOPS)
  }, [rankedPeaks, maxChops, chopCount])

  // Once peaks are ready for an unchopped source, apply the default count so the slider and waveform
  // agree immediately. Runs once; never clobbers existing chops.
  const didInitialHitChop = useRef(false)
  useEffect(() => {
    if (didInitialHitChop.current) return
    if (activeTool !== 'chop' || chopMethod !== 'hits' || rankedPeaks === null) return
    if (maxChops < MIN_HIT_CHOPS) return
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
      if (saved) markSaved()

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
    markSaved,
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

  // Stems tool. Separation runs on the active source; selecting a stem swaps the active audio
  // (forcing a remount via key={audio.path}) so every existing tool operates on the stem.
  const handleSeparateStems = useCallback(() => {
    if (audio) stemsState.separate(audio)
  }, [audio, stemsState])

  const handleSaveStemToLibrary = useCallback(async () => {
    const file = stemsState.stems?.find((s) => s.name === stemsState.selected)
    if (!file) return
    setSavingStemToLibrary(true)
    try {
      await window.api.library.addSample({ name: `${projectName} — ${stemsState.selected}`, filePath: file.filePath })
      toast('Stem added to Library')
    } catch {
      toast('Could not add stem to Library', 'error')
    } finally {
      setSavingStemToLibrary(false)
    }
  }, [stemsState.stems, stemsState.selected, projectName, toast])

  // Clear stem results when a genuinely new source loads (not when viewing one of its own stems).
  const stemsReset = stemsState.reset
  const viewingOwnStem = stemsState.selected !== null && !!stemsState.stems?.some((s) => s.filePath === filePath)
  const stemsOriginalPath = stemsState.originalSource?.filePath
  useEffect(() => {
    if (viewingOwnStem) return
    if (stemsOriginalPath && stemsOriginalPath !== filePath) stemsReset()
  }, [filePath, viewingOwnStem, stemsOriginalPath, stemsReset])

  useZoom({ waveformRef, wavesurfer })

  const selectedCandidateRegion = selectedCandidateId ? candidateRegionsRef.current.get(selectedCandidateId) : undefined
  const playTarget = selectedCandidateRegion ?? selectedRegion

  useShortcuts({
    wavesurfer,
    selectedRegion,
    regions,
    playTarget,
    onPlaySelection: playRegionWithMode,
    onSelectRegion: handleSelectRegion,
    loopMode,
    onUndo: undo,
    onRedo: redo,
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

        {/* Loop mode — when on, playing/clicking a region repeats it */}
        <button
          onClick={handleToggleLoop}
          aria-pressed={loopMode}
          title={loopMode ? 'Loop mode on — playing a region repeats it' : 'Loop mode off — plays once'}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center border transition-colors cursor-pointer',
            loopMode
              ? 'bg-accent/15 text-accent border-accent/40'
              : 'bg-raised text-muted border-border hover:border-accent/40 hover:text-accent'
          )}
        >
          <Repeat size={11} />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* History — shares the toolbar button language */}
        <div className="flex items-center gap-1.5">
          <button
            title="Undo region edit (⌘Z)"
            onClick={undo}
            disabled={!canUndo}
            className={cn(
              'h-[28px] w-[28px] flex items-center justify-center rounded-[6px] border bg-transparent transition-colors',
              canUndo
                ? 'text-muted border-border hover:text-ink hover:border-border-bright cursor-pointer'
                : 'text-faint/30 border-border/50 cursor-not-allowed'
            )}
          >
            <Undo2 size={13} />
          </button>
          <button
            title="Redo region edit (⇧⌘Z)"
            onClick={redo}
            disabled={!canRedo}
            className={cn(
              'h-[28px] w-[28px] flex items-center justify-center rounded-[6px] border bg-transparent transition-colors',
              canRedo
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
          onChopSlideStart: beginSliderEdit,
          onChopSlideEnd: endSliderEdit,
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
        stems={{
          status: stemsState.status,
          progress: stemsState.progress,
          error: stemsState.error,
          stems: stemsState.stems,
          selected: stemsState.selected,
          canRun: !!audio,
          savingToLibrary: savingStemToLibrary,
          onRun: handleSeparateStems,
          onCancel: stemsState.cancel,
          onSelect: (name: StemName) => stemsState.selectStem(name),
          onRestore: stemsState.restoreOriginal,
          onSaveToLibrary: handleSaveStemToLibrary,
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
          onClick={handleRegionClick}
          onPlay={playRegionWithMode}
          onNameChange={updateRegionName}
          onClearAll={handleClearAllRegions}
        />
      </div>

      <div className="flex items-center gap-5 px-5 py-2 border-t border-border bg-surface shrink-0">
        {([['Space', 'Play / Pause'], ['⌫', 'Delete region'], ['↑/↓', 'Prev / Next region'], ['⌘Z', 'Undo'], ['⇧⌘Z', 'Redo']] as const).map(([key, label]) => (
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
