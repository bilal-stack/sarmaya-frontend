
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
  SidebarGroupAction,
  SidebarInset,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { GalsiLogo } from '@/components/auth/galsi-logo';
import { Button } from '@/components/ui/button';
import { FilePlus, Folder, RefreshCw } from 'lucide-react';
import { PitchDeckList } from '@/components/pitch-deck-list';
import { PitchDeckUploadModal } from '@/components/pitch-deck-upload-modal';

type PitchDeckAdvisorContextType = {
  activeDeckId: string | null;
  setActiveDeckId: (id: string | null) => void;
  refreshDecks: () => void;
  uploadCount: number;
};

const PitchDeckAdvisorContext = createContext<PitchDeckAdvisorContextType | null>(null);

export const usePitchDeckAdvisor = () => {
  const context = useContext(PitchDeckAdvisorContext);
  if (!context) {
    throw new Error('usePitchDeckAdvisor must be used within a PitchDeckAdvisorProvider');
  }
  return context;
};

function PitchDeckAdvisorProvider({ children }: { children: React.ReactNode }) {
    const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
    const [uploadCount, setUploadCount] = useState(0);
    
    const refreshDecks = useCallback(() => {
        setUploadCount(prev => prev + 1);
    }, []);

    return (
        <PitchDeckAdvisorContext.Provider value={{ activeDeckId, setActiveDeckId, refreshDecks, uploadCount }}>
            {children}
        </PitchDeckAdvisorContext.Provider>
    )
}

export default function PitchDeckAdvisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <PitchDeckAdvisorProvider>
        <LayoutContent onModalOpenChange={setIsModalOpen} isModalOpen={isModalOpen}>
            {children}
        </LayoutContent>
    </PitchDeckAdvisorProvider>
  );
}


function LayoutContent({children, onModalOpenChange, isModalOpen}: {children: React.ReactNode, onModalOpenChange: (isOpen: boolean) => void, isModalOpen: boolean}) {
    const { refreshDecks, uploadCount } = usePitchDeckAdvisor();
    
    const handleUploadSuccess = () => {
        onModalOpenChange(false);
        refreshDecks();
    };
  
    const handleRefresh = () => {
        refreshDecks();
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
                            <Button variant="default" className="w-full" onClick={() => onModalOpenChange(true)}>
                                <FilePlus />
                                <span>New Pitch Deck</span>
                            </Button>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel className="flex items-center mb-2">
                        <Folder />
                        <span className="ml-2">Pitch Decks Management</span>
                    </SidebarGroupLabel>
                    <SidebarGroupAction onClick={handleRefresh}>
                        <RefreshCw />
                    </SidebarGroupAction>
                    <SidebarSeparator className="mb-2" />
                    <PitchDeckList key={uploadCount} />
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            <header className="flex h-16 items-center justify-between border-b px-6">
            <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h2 className="text-xl font-semibold">Pitch Deck Advisor</h2>
            </div>
            </header>
            <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
        <PitchDeckUploadModal 
            isOpen={isModalOpen}
            onOpenChange={onModalOpenChange}
            onUploadSuccess={handleUploadSuccess}
        />
        </SidebarProvider>
    )
}

    