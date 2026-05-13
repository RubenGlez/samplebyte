import Nav from '@/components/Nav'
import { useUiStore } from '@/stores/ui'
import ChopView from '@/views/Chop'
import LibraryView from '@/views/Library'
import PacksView from '@/views/Packs'

export default function App() {
  const { currentView } = useUiStore()

  return (
    <div className="bg-base h-dvh flex flex-col overflow-hidden">
      <Nav />
      <main className="flex-1 overflow-hidden">
        {currentView === 'chop'    && <ChopView />}
        {currentView === 'library' && <LibraryView />}
        {currentView === 'packs'   && <PacksView />}
      </main>
    </div>
  )
}
