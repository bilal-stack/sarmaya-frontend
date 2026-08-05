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
import { BusinessConceptAssessorChatList, type ChatRoom as BcaChatRoom } from '@/components/business-concept-assessor-chat-list';
import { NewConceptChatModal, type NewConceptChatData } from '@/components/business-concept-assessor-new-chat-modal';

export type ChatRoom = BcaChatRoom;

type BusinessConceptAssessorContextType = {
  activeChat: ChatRoom | null;
  setActiveChat: (chat: ChatRoom | null) => void;
  refreshChatList: () => void;
  refreshCount: number;
  startNewChat: (data: NewConceptChatData) => void;
  newChatData: NewConceptChatData | null;
  clearNewChatData: () => void;
};

const BusinessConceptAssessorContext = createContext<BusinessConceptAssessorContextType | null>(null);

export const useBusinessConceptAssessor = () => {
  const context = useContext(BusinessConceptAssessorContext);
  if (!context) {
    throw new Error('useBusinessConceptAssessor must be used within a BusinessConceptAssessorProvider');
  }
  return context;
};

function BusinessConceptAssessorProvider({ children }: { children: React.ReactNode }) {
    const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [newChatData, setNewChatData] = useState<NewConceptChatData | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const refreshChatList = useCallback(() => setRefreshCount(prev => prev + 1), []);
    
    const startNewChat = useCallback((data: NewConceptChatData) => {
        setNewChatData(data);
        setActiveChat(null);
        if (pathname === '/ai-tools/business-concept-assessor') {
            router.replace('/ai-tools/business-concept-assessor?new=' + Date.now());
        } else {
            router.push('/ai-tools/business-concept-assessor');
        }
    }, [pathname, router]);

    const clearNewChatData = useCallback(() => {
        setNewChatData(null);
    }, []);

    return (
        <BusinessConceptAssessorContext.Provider value={{ activeChat, setActiveChat, refreshChatList, refreshCount, startNewChat, newChatData, clearNewChatData }}>
            {children}
        </BusinessConceptAssessorContext.Provider>
    )
}

function BusinessConceptAssessorLayoutContent({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const { startNewChat, refreshChatList } = useBusinessConceptAssessor();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const handleNewChatClick = () => {
      setIsModalOpen(true);
    };

    const handleModalContinue = async (data: NewConceptChatData) => {
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
                                <Button variant="default" className="w-full" onClick={handleNewChatClick}>
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
                        <BusinessConceptAssessorChatList />
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                <header className="flex h-16 items-center justify-between border-b px-6">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <h2 className="text-xl font-semibold">Business Concept Assessor</h2>
                </div>
                </header>
                <main className="flex-1 flex flex-col p-6">{children}</main>
            </SidebarInset>
            </SidebarProvider>
             <NewConceptChatModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onContinue={handleModalContinue}
            />
        </>
    );
  }

export function BusinessConceptAssessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BusinessConceptAssessorProvider>
      <BusinessConceptAssessorLayoutContent>
        {children}
      </BusinessConceptAssessorLayoutContent>
    </BusinessConceptAssessorProvider>
  );
}
