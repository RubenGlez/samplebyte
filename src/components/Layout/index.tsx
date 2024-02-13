interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="bg-slate-950 h-dvh flex flex-col items-center justify-center bg-no-repeat bg-cover bg-blend-color bg-main">
      {children}
    </div>
  );
}
