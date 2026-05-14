import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/player'
import { useProjectsStore } from '@/stores/projects'
import Loader from '@/components/Loader'
import Editor from '@/components/Editor'

export default function ChopView() {
  const { audio } = usePlayerStore()
  const { fetchProjects } = useProjectsStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  if (audio) {
    return <Editor name={audio.name} size={audio.size} type={audio.type} path={audio.path} filePath={audio.filePath} />
  }

  return (
    <div className="flex items-center justify-center h-full px-8 py-6 overflow-y-auto">
      <div className="w-full max-w-xl">
        <Loader />
      </div>
    </div>
  )
}
