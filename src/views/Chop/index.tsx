import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import Loader from '@/components/Loader'
import AudioWaveform from '@/components/AudioWaveform'

export default function ChopView() {
  const { audio } = usePlayerStore()
  const { activeProject, fetchProjects } = useProjectsStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  if (audio) {
    // key forces a full remount when the URL changes (e.g. blob→local-file://),
    // resetting isConfigured.current in useWaveSurfer so a new WaveSurfer instance is created.
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <AudioWaveform
          key={audio.path}
          audioUrl={audio.path}
          audioName={audio.name}
          filePath={audio.filePath}
          size={audio.size}
          type={audio.type}
          initialRegions={audio.initialRegions ?? activeProject?.regions}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full px-8 py-6 overflow-y-auto">
      <div className="w-full max-w-xl">
        <Loader />
      </div>
    </div>
  )
}
