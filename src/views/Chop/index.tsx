import { usePlayerStore } from '@/stores/player'
import Loader from '@/components/Loader'
import Editor from '@/components/Editor'

export default function ChopView() {
  const { audio } = usePlayerStore()

  return (
    <div className="flex items-center justify-center h-full p-8">
      {audio ? (
        <Editor name={audio.name} size={audio.size} type={audio.type} path={audio.path} filePath={audio.filePath} />
      ) : (
        <Loader />
      )}
    </div>
  )
}
