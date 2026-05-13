import { HTMLProps } from 'react'

interface CardRootProps extends HTMLProps<HTMLDivElement> {
  children: React.ReactNode
}

export default function CardRoot({ children, className = '', ...rest }: CardRootProps) {
  return (
    <div
      className={`w-full relative border border-border rounded-lg bg-surface shadow-[0_4px_32px_rgba(0,0,0,0.5)] overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
