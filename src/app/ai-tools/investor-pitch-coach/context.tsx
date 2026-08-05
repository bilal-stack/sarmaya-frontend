
'use client';

/**
 * Context and provider for this tool.
 *
 * Split out of layout.tsx because the App Router only permits a specific set
 * of exports from a layout file; a hook exported alongside the component made
 * the generated route types fail to compile, which blocked `next build`.
 */
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
import { useRouter, usePathname } from 'next/navigation';
import { InvestorPitchCoachChatList, type ChatRoom } from '@/components/investor-pitch-coach-chat-list';
import { NewPitchChatModal, type NewPitchChatData } from '@/components/investor-pitch-coach-new-chat-modal';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { StreamParser, type ParsedStreamData } from '@/lib/stream-parser';

type InvestorPitchCoachContextType = {
  activeChat: ChatRoom | null;
  setActiveChat: (chat: ChatRoom | null) => void;
  refreshChatList: () => void;
  refreshCount: number;
  startNewChat: (data: NewPitchChatData) => void;
  newChatData: NewPitchChatData | null;
  clearNewChatData: () => void;
};

const InvestorPitchCoachContext = createContext<InvestorPitchCoachContextType | null>(null);

export const useInvestorPitchCoach = () => {
  const context = useContext(InvestorPitchCoachContext);
  if (!context) {
    throw new Error('useInvestorPitchCoach must be used within a InvestorPitchCoachProvider');
  }
  return context;
};

function InvestorPitchCoachProvider({ children }: { children: React.ReactNode }) {
    const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [newChatData, setNewChatData] = useState<NewPitchChatData | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const refreshChatList = useCallback(() => setRefreshCount(prev => prev + 1), []);
    
    const startNewChat = useCallback((data: NewPitchChatData) => {
        setNewChatData(data);
        setActiveChat(null); // This is key to signal a new chat starts
        // Ensure navigation happens to trigger re-renders if already on the page
        if (pathname === '/ai-tools/investor-pitch-coach') {
            router.replace('/ai-tools/investor-pitch-coach?new=' + Date.now());
        } else {
            router.push('/ai-tools/investor-pitch-coach');
        }
    }, [pathname, router]);

    const clearNewChatData = useCallback(() => {
        setNewChatData(null);
    }, []);

    return (
        <InvestorPitchCoachContext.Provider value={{ activeChat, setActiveChat, refreshChatList, refreshCount, startNewChat, newChatData, clearNewChatData }}>
            {children}
        </InvestorPitchCoachContext.Provider>
    )
}

function InvestorPitchCoachLayoutContent({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const { startNewChat, refreshChatList } = useInvestorPitchCoach();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const handleNewChatClick = () => {
      setIsModalOpen(true);
    };

    const handleModalContinue = async (data: NewPitchChatData) => {
        setIsModalOpen(false);
        startNewChat(data);
    };
    
    return (
        <>
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
                                <Button variant="default" className="w-full" onClick={handleNewChatClick} disabled={isCreatingChat}>
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
                        <InvestorPitchCoachChatList />
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                <header className="flex h-16 items-center justify-between border-b px-6">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <h2 className="text-xl font-semibold">Investor Pitch Coach</h2>
                </div>
                </header>
                <main className="flex-1 flex flex-col p-6">{children}</main>
            </SidebarInset>
            </SidebarProvider>
             <NewPitchChatModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onContinue={handleModalContinue}
            />
        </>
    );
  }

export function InvestorPitchCoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InvestorPitchCoachProvider>
      <InvestorPitchCoachLayoutContent>
        {children}
      </InvestorPitchCoachLayoutContent>
    </InvestorPitchCoachProvider>
  );
}
