import { useEffect } from 'react'
import Toolbar from '@/components/Toolbar'
import AppSidebar from '@/components/AppSidebar'
import { Toaster } from '@/components/ui/Toaster'
import { useUiStore } from '@/stores/ui'
import { useProjectsStore } from '@/stores/projects'
import { usePacksStore } from '@/stores/packs'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import ChopView from '@/views/Chop'
import LibraryView from '@/views/Library'
import PacksView from '@/views/Packs'
import { toLocalFileUrl, fileNameFromPath, mimeTypeFromPath } from '@/utils'

export default function App() {
  const { currentView } = useUiStore()
  const { fetchProjects, setActiveProject } = useProjectsStore()
  const { fetchPacks, setCurrentPack } = usePacksStore()
  const { fetchSamples } = useLibraryStore()
  const { setAudio } = usePlayerStore()

  useEffect(() => {
    async function init() {
      await Promise.all([fetchProjects(), fetchPacks(), fetchSamples()])

      const { projects, activeProject } = useProjectsStore.getState()
      if (!activeProject && projects.length > 0) {
        const first = projects[0]
        setActiveProject(first)
        if (first.sourcePath) {
          setAudio({
            name: first.sourceName ?? fileNameFromPath(first.sourcePath),
            path: toLocalFileUrl(first.sourcePath),
            filePath: first.sourcePath,
            size: 0,
            type: mimeTypeFromPath(first.sourcePath),
            source: first.source,
          })
        }
      }

      const { packs, currentPack } = usePacksStore.getState()
      if (!currentPack && packs.length > 0) {
        setCurrentPack(packs[0])
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-base h-dvh flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-hidden bg-base">
          {currentView === 'chop'    && <ChopView />}
          {currentView === 'library' && <LibraryView />}
          {currentView === 'packs'   && <PacksView />}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
