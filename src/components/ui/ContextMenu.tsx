import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type ContextMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
}

type Props = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 100 }}
      className="min-w-[148px] bg-surface border border-border rounded-lg shadow-2xl shadow-black/60 py-1 overflow-hidden"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className={cn(
            'w-full text-left px-3 h-[28px] text-[12px] transition-colors bg-transparent border-0 cursor-pointer',
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-ink hover:bg-raised'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
