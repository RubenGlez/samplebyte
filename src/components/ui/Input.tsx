import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full bg-raised border border-border rounded-md px-3 h-8 text-[13px] text-ink',
      'placeholder:text-faint focus:outline-none focus:border-accent/40 focus:bg-overlay',
      'transition-colors',
      className
    )}
    {...props}
  />
))

Input.displayName = 'Input'
