
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
import { usePathname, useRouter } from 'next/navigation';
import { LifeScienceChatList } from '@/components/life-science-chat-list';

export const LIFE_SCIENCE_DEFAULT_CHAT_TITLE = 'Life Science Intelligence Report';

type LifeScienceChatbotContextType = {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  refreshChatList: () => void;
  refreshCount: number;
  activeChatTitle: string;
  setActiveChatTitle: (title: string) => void;
};

const LifeScienceChatbotContext = createContext<LifeScienceChatbotContextType | null>(null);

export const useLifeScienceChatbot = () => {
  const context = useContext(LifeScienceChatbotContext);
  if (!context) {
    throw new Error('useLifeScienceChatbot must be used within a LifeScienceChatbotProvider');
  }
  return context;
};

function LifeScienceChatbotProvider({ children }: { children: React.ReactNode }) {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);
  const [activeChatTitle, setActiveChatTitle] = useState<string>(LIFE_SCIENCE_DEFAULT_CHAT_TITLE);

    const refreshChatList = useCallback(() => setRefreshCount(prev => prev + 1), []);

    return (
    <LifeScienceChatbotContext.Provider
      value={{ activeChatId, setActiveChatId, refreshChatList, refreshCount, activeChatTitle, setActiveChatTitle }}
    >
            {children}
        </LifeScienceChatbotContext.Provider>
    )
}

function LifeScienceChatbotLayoutContent({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const router = useRouter();
    const { setActiveChatId, refreshChatList, setActiveChatTitle } = useLifeScienceChatbot();
    
    const handleNewChat = () => {
      // Clear the active chat ID to reset the page component to its initial state.
      setActiveChatId(null);
      setActiveChatTitle(LIFE_SCIENCE_DEFAULT_CHAT_TITLE);
      // If we are already on the main page, router.push won't trigger a re-render
      // but clearing the ID will. If not on the main page, navigate to it.
      if (router.pathname !== '/ai-tools/life-science-chatbot') {
        router.push('/ai-tools/life-science-chatbot');
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
                     <LifeScienceChatList />
                </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h2 className="text-xl font-semibold">Life Science Chatbot</h2>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
    );
  }

export default function LifeScienceChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LifeScienceChatbotProvider>
      <LifeScienceChatbotLayoutContent>
        {children}
      </LifeScienceChatbotLayoutContent>
    </LifeScienceChatbotProvider>
  );
}
