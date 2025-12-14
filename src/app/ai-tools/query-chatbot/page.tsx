'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, Search, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { QueryResponse } from '@/types/chatbot';

type QueryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

const WelcomeCard = () => (
  <div className="flex h-full items-center justify-center">
    <Card className="w-full max-w-lg text-center bg-card/50">
      <CardContent className="pt-12 pb-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Search className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Natural Language Query</h2>
        <p className="text-muted-foreground">
          Ask questions about your invoices in plain English.
          <br />
          Examples: "Show pending invoices", "Total paid this month"
        </p>
      </CardContent>
    </Card>
  </div>
);

export default function QueryChatbotPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuery = async () => {
    if (!query.trim() || !user?.access_token) return;

    const userMessage: QueryMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuery = query;
    setQuery('');
    setIsQuerying(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.CHATBOT.QUERY,
        {
          method: 'POST',
          body: JSON.stringify({ query: currentQuery }),
        },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Query failed');
      }

      const result: QueryResponse = await response.json();

      // Build response message with metadata
      let responseContent = result.ai_response;
      
      if (result.function_called || result.sql_executed) {
        responseContent += '\n\n---\n';
        if (result.function_called) {
          responseContent += `\n**Function Called:** ${result.function_called}`;
        }
        if (result.sql_executed) {
          responseContent += '\n**SQL Executed:** Yes';
        }
        if (result.data && Array.isArray(result.data)) {
          responseContent += `\n**Results:** ${result.data.length} record(s) found`;
        }
      }

      const assistantMessage: QueryMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to execute query',
      });
      
      const errorMessage: QueryMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your query. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="h-full">
      <Card className="h-full border-border/50 shadow-lg shadow-black/20">
        <CardContent className="h-full p-0">
          <div className="flex h-full flex-col">
            {messages.length === 0 ? (
              <WelcomeCard />
            ) : (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex w-full items-start gap-4 ${
                        msg.role === 'user' ? 'justify-end' : ''
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <Avatar>
                          <AvatarFallback>
                            <Search className="h-5 w-5" />
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
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isQuerying && (
                    <div className="flex w-full items-start gap-4">
                      <Avatar>
                        <AvatarFallback>
                          <Search className="h-5 w-5" />
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
                  placeholder="Ask about your invoices... (e.g., 'Show me pending invoices')"
                  className="pr-12"
                  rows={1}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleQuery();
                    }
                  }}
                  disabled={isQuerying}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <Button
                    type="submit"
                    size="icon"
                    onClick={handleQuery}
                    disabled={isQuerying || !query.trim()}
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
