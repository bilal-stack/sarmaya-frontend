'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { useAiChatbot } from '@/app/ai-tools/ai-chatbot/layout';
import { AiChatbotConversationList } from '@/components/ai-chatbot-conversation-list';

export function AiChatbotSidebar() {
  const { setActiveConversationId, refreshConversations } = useAiChatbot();

  const handleNewChat = () => {
    setActiveConversationId(null);
    refreshConversations();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Button onClick={handleNewChat} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <AiChatbotConversationList />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
