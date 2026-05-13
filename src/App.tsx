import Editor from './components/Editor'
import Loader from './components/Loader'
import Layout from './components/Layout'
import { usePlayerStore } from './stores/player'

export default function App() {
  const { audio, setAudio } = usePlayerStore()

  const handleFileLoaded = (file: File) => {
    setAudio({
      name: file.name,
      path: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
    })
  }

  return (
    <Layout>
      {audio ? (
        <Editor name={audio.name} size={audio.size} type={audio.type} path={audio.path} />
      ) : (
        <Loader onFileLoaded={handleFileLoaded} />
      )}
    </Layout>
  )
}
