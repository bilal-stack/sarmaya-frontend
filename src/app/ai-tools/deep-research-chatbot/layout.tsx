
'use client';
import { useState, createContext, useContext, useCallback } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarGroupAction,
} from '@/components/ui/sidebar';
import { GalsiLogo } from '@/components/auth/galsi-logo';
import { Button } from '@/components/ui/button';
import { FilePlus, Folder, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DeepResearchChatList } from '@/components/deep-research-chat-list';

type DeepResearchChatbotContextType = {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  refreshChatList: () => void;
  refreshCount: number;
};

const DeepResearchChatbotContext = createContext<DeepResearchChatbotContextType | null>(null);

export const useDeepResearchChatbot = () => {
  const context = useContext(DeepResearchChatbotContext);
  if (!context) {
    throw new Error('useDeepResearchChatbot must be used within a DeepResearchChatbotProvider');
  }
  return context;
};

function DeepResearchChatbotProvider({ children }: { children: React.ReactNode }) {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);

    const refreshChatList = useCallback(() => setRefreshCount(prev => prev + 1), []);

    return (
        <DeepResearchChatbotContext.Provider value={{ activeChatId, setActiveChatId, refreshChatList, refreshCount }}>
            {children}
        </DeepResearchChatbotContext.Provider>
    )
}

function DeepResearchChatbotLayoutContent({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const router = useRouter();
    const { setActiveChatId, refreshChatList } = useDeepResearchChatbot();
    
    const handleNewChat = () => {
      setActiveChatId(null);
      if (router.pathname !== '/ai-tools/deep-research-chatbot') {
        router.push('/ai-tools/deep-research-chatbot');
      }
    };
    
    return (
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <GalsiLogo className="w-6 h-6 text-primary" />
                    <h1 className="font-headline text-lg">Galsi</h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <Button variant="default" className="w-full" onClick={handleNewChat}>
                                <FilePlus />
                                <span>New Chat</span>
                            </Button>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel className="flex items-center">
                        <Folder />
                        <span className="ml-2">Chat History</span>
                    </SidebarGroupLabel>
                     <SidebarGroupAction onClick={refreshChatList}>
                          <RefreshCw />
                      </SidebarGroupAction>
                     <DeepResearchChatList />
                </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h2 className="text-xl font-semibold">Deep Research Chatbot</h2>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
    );
  }

export default function DeepResearchChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeepResearchChatbotProvider>
      <DeepResearchChatbotLayoutContent>
        {children}
      </DeepResearchChatbotLayoutContent>
    </DeepResearchChatbotProvider>
  );
}
