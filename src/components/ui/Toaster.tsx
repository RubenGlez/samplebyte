import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '@/stores/toast'
import { cn } from '@/lib/utils'

const icons = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
}

const styles = {
  success: 'text-accent border-accent/20',
  error:   'text-red-400 border-red-500/20',
  info:    'text-muted border-border-bright',
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border bg-overlay shadow-xl shadow-black/40',
              'min-w-[220px] max-w-xs',
              styles[t.type]
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span className="text-[13px] text-ink flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-faint hover:text-muted bg-transparent border-0 p-0 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
