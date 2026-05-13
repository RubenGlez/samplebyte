import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full bg-white/5 border border-white/10 rounded px-3 h-9 text-sm text-white',
      'placeholder:text-white/30 focus:outline-none focus:border-sky-500/60',
      'transition-colors',
      className
    )}
    {...props}
  />
))

Input.displayName = 'Input'
