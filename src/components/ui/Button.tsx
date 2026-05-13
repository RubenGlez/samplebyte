import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded text-sm font-medium transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-0 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-[#0A0806] font-semibold hover:bg-accent-bright active:scale-[0.97]',
        ghost:   'bg-transparent text-muted hover:text-ink hover:bg-raised active:bg-overlay',
        outline: 'bg-transparent border border-border-bright text-muted hover:text-ink hover:border-accent/40 active:bg-raised',
        danger:  'bg-transparent text-red-400/70 hover:text-red-400 hover:bg-red-500/10',
      },
      size: {
        sm:   'h-7 px-3 text-xs',
        md:   'h-8 px-4 text-sm',
        lg:   'h-9 px-5 text-sm',
        icon: 'h-7 w-7 p-0 text-xs',
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
