import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import { getTelemetryEnabled, setTelemetryEnabled } from '@/lib/analytics'
import { cn } from '@/lib/utils'

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [telemetry, setTelemetry] = useState(true)

  useEffect(() => {
    if (open) getTelemetryEnabled().then(setTelemetry)
  }, [open])

  async function toggle() {
    const next = !telemetry
    setTelemetry(next)
    await setTelemetryEnabled(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] text-ink">Share anonymous usage data</div>
            <p className="text-[11px] text-faint mt-1 leading-relaxed">
              Reports app opens and crashes so I can fix bugs I can't reproduce. No audio, file
              names, or personal data ever leave your machine.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={telemetry}
            aria-label="Share anonymous usage data"
            onClick={toggle}
            className={cn(
              'relative shrink-0 w-9 h-5 rounded-full transition-colors cursor-pointer border-0 mt-0.5',
              telemetry ? 'bg-accent' : 'bg-raised'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                telemetry ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
