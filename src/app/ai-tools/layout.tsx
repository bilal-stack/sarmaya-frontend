import { Header } from '@/components/header';

export default function AiToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col bg-background">
        {children}
      </main>
    </div>
  );
}
