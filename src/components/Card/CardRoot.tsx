import { HTMLProps } from "react";

interface CardRootProps extends HTMLProps<HTMLDivElement> {
  children: React.ReactNode;
}

export default function CardRoot({ children, ...rest }: CardRootProps) {
  return (
    <div
      className="w-600 relative border border-white/10 border-solid rounded-md bg-white/5 backdrop-blur shadow-lg"
      {...rest}
    >
      {children}
    </div>
  );
}
