import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0',
  {
    variants: {
      variant: {
        primary: 'bg-white/90 text-black hover:bg-white',
        ghost:   'bg-transparent text-white/60 hover:text-white hover:bg-white/5',
        danger:  'bg-red-500/20 text-red-400 hover:bg-red-500/30',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-9 px-4',
        icon: 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
