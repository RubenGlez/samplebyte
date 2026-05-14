import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ children, ...props }: RadixDialog.DialogProps) {
  return <RadixDialog.Root {...props}>{children}</RadixDialog.Root>
}

export const DialogTrigger = RadixDialog.Trigger

export function DialogContent({ children, className, ...props }: RadixDialog.DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-sm bg-surface border border-border-bright rounded-lg p-6 shadow-2xl',
          'focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close className="absolute top-4 right-4 text-faint hover:text-muted transition-colors">
          <X size={15} />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}

export function DialogTitle({ children, className, ...props }: RadixDialog.DialogTitleProps) {
  return (
    <RadixDialog.Title
      className={cn('text-ink text-sm font-semibold mb-4 tracking-wide uppercase font-brand', className)}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  )
}

export const DialogClose = RadixDialog.Close
