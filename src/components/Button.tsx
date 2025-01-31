interface ExportButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  children: React.ReactNode;
}

export default function Button({ children, ...props }: ExportButtonProps) {
  return (
    <button
      className="bg-white/80 border-0 rounded h-8 px-4 text-black text-md font-medium p-0 m-0"
      {...props}
    >
      {children}
    </button>
  );
}
