'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AiChatbotSidebar } from '@/components/ai-chatbot-sidebar';

type AiChatbotContextType = {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshCount: number;
  refreshConversations: () => void;
};

const AiChatbotContext = createContext<AiChatbotContextType | undefined>(undefined);

export function useAiChatbot() {
  const context = useContext(AiChatbotContext);
  if (!context) {
    throw new Error('useAiChatbot must be used within AiChatbotProvider');
  }
  return context;
}

export default function AiChatbotLayout({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const refreshConversations = () => {
    setRefreshCount(prev => prev + 1);
  };

  return (
    <AiChatbotContext.Provider
      value={{
        activeConversationId,
        setActiveConversationId,
        refreshCount,
        refreshConversations,
      }}
    >
      <SidebarProvider>
        <div className="flex h-full w-full">
          <AiChatbotSidebar />
          <div className="flex-1">{children}</div>
        </div>
      </SidebarProvider>
    </AiChatbotContext.Provider>
  );
}
