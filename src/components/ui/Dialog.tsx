import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export function Dialog({ children, ...props }: RadixDialog.DialogProps) {
  return <RadixDialog.Root {...props}>{children}</RadixDialog.Root>
}

export function DialogTrigger(props: RadixDialog.DialogTriggerProps) {
  return <RadixDialog.Trigger {...props} />
}

export function DialogContent({ children, className, ...props }: RadixDialog.DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-sm bg-surface border border-border rounded-xl p-6 shadow-2xl shadow-black/60',
          'focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}

export function DialogTitle({ children, className, ...props }: RadixDialog.DialogTitleProps) {
  return (
    <RadixDialog.Title
      className={cn('text-ink text-[13px] font-semibold mb-4', className)}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  )
}

export function DialogClose(props: RadixDialog.DialogCloseProps) {
  return <RadixDialog.Close {...props} />
}
