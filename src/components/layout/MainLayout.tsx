import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useOrdersRealtime } from '@/hooks/useOrdersRealtime';
import { AIAssistantWidget } from '@/components/ai/AIAssistantWidget';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Global realtime subscription — survives page navigations
  useOrdersRealtime();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </main>
      </div>
      <AIAssistantWidget />
    </div>
  );
}
