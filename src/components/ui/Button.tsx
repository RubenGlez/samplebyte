import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-0 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-bright active:brightness-90',
        ghost:   'bg-transparent text-muted hover:text-ink hover:bg-raised active:bg-overlay',
        outline: 'bg-transparent border border-border-bright text-muted hover:text-ink hover:border-accent/40 active:bg-raised',
        danger:  'bg-transparent text-red-400/70 hover:text-red-400 hover:bg-red-500/10',
      },
      size: {
        sm:   'h-[26px] px-2.5 text-[12px]',
        md:   'h-[28px] px-3 text-[13px]',
        lg:   'h-[32px] px-4 text-[13px]',
        icon: 'h-[26px] w-[26px] p-0 text-[12px]',
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
