import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full bg-base border border-border-bright rounded px-3 h-9 text-sm text-ink',
      'placeholder:text-faint focus:outline-none focus:border-accent/50 focus:bg-surface',
      'transition-colors',
      className
    )}
    {...props}
  />
))

Input.displayName = 'Input'
