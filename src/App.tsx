import Toolbar from '@/components/Toolbar'
import AppSidebar from '@/components/AppSidebar'
import { Toaster } from '@/components/ui/Toaster'
import { useUiStore } from '@/stores/ui'
import ChopView from '@/views/Chop'
import LibraryView from '@/views/Library'
import PacksView from '@/views/Packs'

export default function App() {
  const { currentView } = useUiStore()

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
