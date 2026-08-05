'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import type { Conversation } from '@/types/chatbot';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiChatbot } from '@/app/ai-tools/ai-chatbot/context';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AiChatbotConversationList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activeConversationId, setActiveConversationId, refreshCount } = useAiChatbot();

  const fetchConversations = useCallback(async () => {
    if (!user?.access_token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch(
        `${API_ENDPOINTS.CHATBOT.LIST}?limit=50&offset=0`,
        {},
        user.access_token
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();

      // Handle both array response and object with conversations array
      const conversationsArray = Array.isArray(data) ? data : data.conversations || [];
      setConversations(conversationsArray);
    } catch (error: any) {
      console.error('Fetch conversations error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load conversations',
      });
      // Set empty array on error to prevent map error
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.access_token, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshCount]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await apiFetch(
        API_ENDPOINTS.CHATBOT.DELETE(id),
        { method: 'DELETE' },
        user?.access_token
      );

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      toast({
        title: 'Success',
        description: 'Conversation deleted successfully',
      });

      if (activeConversationId === id) {
        setActiveConversationId(null);
      }

      fetchConversations();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete conversation',
      });
    }
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        {[...Array(5)].map((_, i) => (
          <SidebarMenuItem key={i}>
            <Skeleton className="h-8 w-full" />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      {conversations.map((conversation) => (
        <SidebarMenuItem key={conversation.id} onClick={() => setActiveConversationId(conversation.id)}>
          <SidebarMenuButton isActive={activeConversationId === conversation.id} className="w-full justify-between">
            <span className="truncate">{conversation.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => handleDelete(conversation.id, e)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
      {conversations.length === 0 && (
        <SidebarMenuItem>
          <p className="p-2 text-xs text-muted-foreground">No conversations yet. Start a new chat!</p>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  );
}
