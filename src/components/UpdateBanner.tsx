import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToastStore } from '@/stores/toast'

type Status = 'idle' | 'available' | 'downloading' | 'ready'

// Surfaces the auto-updater to the user (F18). Checks once on mount and then reacts to the updater's
// push events. Dormant in dev / when no update exists (status stays 'idle', nothing renders).
export function UpdateBanner() {
  const [status, setStatus] = useState<Status>('idle')
  const [newVersion, setNewVersion] = useState<string | undefined>()
  const [percent, setPercent] = useState(0)
  const { toast } = useToastStore()

  useEffect(() => {
    const unsubs = [
      window.api.events.onUpdateAvailable((info) => { setNewVersion(info.newVersion); setStatus('available') }),
      window.api.events.onUpdateProgress((p) => { setPercent(Math.round(p)); setStatus('downloading') }),
      window.api.events.onUpdateDownloaded(() => setStatus('ready')),
      window.api.events.onUpdateError((message) => toast(`Update failed: ${message}`, 'error')),
    ]

    // Fire-and-forget: an available update also arrives via onUpdateAvailable, but checking here
    // covers the case where the check resolves before the event listener is attached.
    window.api.updates.check().then((result) => {
      if ('available' in result && result.available) {
        setNewVersion(result.newVersion)
        setStatus('available')
      }
    })

    return () => unsubs.forEach((u) => u())
  }, [toast])

  if (status === 'idle') return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-accent/10 border-b border-accent/20 text-[12px] text-ink">
      {status === 'available' && (
        <>
          <span>A new version{newVersion ? ` (${newVersion})` : ''} is available.</span>
          <Button size="sm" variant="outline" onClick={() => { setStatus('downloading'); window.api.updates.download() }}>
            <Download size={12} />
            Download
          </Button>
        </>
      )}
      {status === 'downloading' && <span className="text-muted">Downloading update… {percent}%</span>}
      {status === 'ready' && (
        <>
          <span>Update ready.</span>
          <Button size="sm" variant="outline" onClick={() => window.api.updates.install()}>
            <RefreshCw size={12} />
            Restart to install
          </Button>
        </>
      )}
    </div>
  )
}
