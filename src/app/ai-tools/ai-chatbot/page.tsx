'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import type { Conversation, ChatMessage as ChatbotMessage } from '@/types/chatbot';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Bot, MessageSquare } from 'lucide-react';
import { useAiChatbot } from './context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const WelcomeCard = () => (
  <div className="flex h-full items-center justify-center">
    <Card className="w-full max-w-lg text-center bg-card/50">
      <CardContent className="pt-12 pb-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
          <MessageSquare className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to AI Chatbot</h2>
        <p className="text-muted-foreground">
          Start a conversation by typing a message below.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default function AiChatbotPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeConversationId, setActiveConversationId, refreshConversations } = useAiChatbot();

  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversationHistory = useCallback(async (conversationId: string) => {
    if (!user?.access_token) return;

    setIsLoadingHistory(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.CHATBOT.MESSAGES(conversationId),
        {},
        user.access_token
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversation history');
      }

      const data: Conversation = await response.json();
      setMessages(data.messages || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load conversation history',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.access_token, toast]);

  useEffect(() => {
    if (activeConversationId) {
      fetchConversationHistory(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchConversationHistory]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user?.access_token) return;

    const userMessage: ChatbotMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setIsSending(true);

    try {
      const response = await fetch(API_ENDPOINTS.CHATBOT.CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          message: currentMessage,
          conversation_id: activeConversationId || undefined,
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('sarmaya_user_data');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send message');
      }

      const data = await response.json();

      // If this was a new conversation, update the active conversation ID
      if (!activeConversationId && data.conversation_id) {
        setActiveConversationId(data.conversation_id);
        refreshConversations();
      }

      // Add assistant message - API returns "message" field
      const assistantMessage: ChatbotMessage = {
        id: data.message_id || `temp-${Date.now()}`,
        conversation_id: data.conversation_id || activeConversationId || '',
        role: data.role || 'assistant',
        content: data.message || data.response || data.content || 'No response',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send message',
      });
      // Remove the user message on error
      setMessages((prev) => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full">
      <Card className="h-full border-border/50 shadow-lg shadow-black/20">
        <CardContent className="h-full p-0">
          <div className="flex h-full flex-col">
            {messages.length === 0 && !isLoadingHistory ? (
              <WelcomeCard />
            ) : (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex w-full items-start gap-4 ${
                        msg.role === 'user' ? 'justify-end' : ''
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <Avatar>
                          <AvatarImage src="https://picsum.photos/seed/ai-chatbot/40/40" />
                          <AvatarFallback>
                            <Bot className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`prose prose-sm prose-invert max-w-[85%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {msg.role === 'user' && (
                        <Avatar>
                          <AvatarImage src="https://picsum.photos/seed/user-avatar/40/40" />
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex w-full items-start gap-4">
                      <Avatar>
                        <AvatarFallback>
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg bg-muted p-3">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            )}
            <div className="border-t bg-background p-4">
              <div className="relative">
                <Textarea
                  placeholder="Ask about invoices, payments, or anything else..."
                  className="pr-12"
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <Button
                    type="submit"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={isSending || !message.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
