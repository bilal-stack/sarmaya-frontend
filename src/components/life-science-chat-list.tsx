
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useLifeScienceChatbot, LIFE_SCIENCE_DEFAULT_CHAT_TITLE } from '@/app/ai-tools/life-science-chatbot/layout';

type ChatRoom = {
    id: string;
    chat_title: string;
};

type Pagination = {
    last_page: boolean;
    current_page: number;
    continuation_token: string | null;
};

export function LifeScienceChatList() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const { activeChatId, setActiveChatId, refreshCount, setActiveChatTitle, activeChatTitle } = useLifeScienceChatbot();

    const observer = useRef<IntersectionObserver>();
    
    const fetchChatRooms = useCallback(async (page = 1, continuationToken: string | null = null) => {
        if (page > 1) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
        }

        if (!user?.access_token) {
            toast({ variant: 'destructive', title: 'Authentication Error' });
            setIsLoading(false);
            setIsFetchingMore(false);
            return;
        }

        try {
            let url = `http://localhost:8000/api/v1/life-science-chatbot?page=${page}&per_page=15`;
            if (continuationToken) {
                 url += `&continuation_token=${continuationToken}`;
            }
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${user.access_token}` },
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.response_description || 'Failed to fetch chat rooms.');
            }
            
            const newChats = result.data.search_result;
            setChatRooms(prev => page === 1 ? newChats : [...prev, ...newChats]);
            setPagination(result.data.pagination);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [user, toast]);

    const lastChatElementRef = useCallback((node: HTMLLIElement) => {
        if (isLoading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && pagination && !pagination.last_page) {
                fetchChatRooms(pagination.current_page + 1, pagination.continuation_token);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, isFetchingMore, pagination, fetchChatRooms]);

    useEffect(() => {
        fetchChatRooms(1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshCount]);

    useEffect(() => {
        if (!activeChatId) return;
        const currentChat = chatRooms.find(chat => chat.id === activeChatId);
        if (currentChat && currentChat.chat_title !== activeChatTitle) {
            setActiveChatTitle(currentChat.chat_title || LIFE_SCIENCE_DEFAULT_CHAT_TITLE);
        }
    }, [activeChatId, chatRooms, activeChatTitle, setActiveChatTitle]);

    if (isLoading) {
        return (
            <SidebarMenu>
                {[...Array(8)].map((_, i) => (
                    <SidebarMenuItem key={i}>
                        <Skeleton className="h-8 w-full" />
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        );
    }

    return (
        <SidebarMenu>
            {chatRooms.map((chat, index) => {
                const isLastElement = chatRooms.length === index + 1;
                return (
                    <SidebarMenuItem 
                        key={chat.id}
                        ref={isLastElement ? lastChatElementRef : null}
                        onClick={() => {
                            setActiveChatId(chat.id);
                            setActiveChatTitle(chat.chat_title || LIFE_SCIENCE_DEFAULT_CHAT_TITLE);
                        }}
                    >
                        <SidebarMenuButton isActive={activeChatId === chat.id} className="w-full justify-start">
                            <span className="truncate">{chat.chat_title}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}
             {isFetchingMore && (
                <SidebarMenuItem>
                    <div className="flex justify-center items-center h-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                </SidebarMenuItem>
            )}
            {!isLoading && chatRooms.length === 0 && (
                <SidebarMenuItem>
                    <p className="p-2 text-xs text-muted-foreground">No chat history found.</p>
                </SidebarMenuItem>
            )}
        </SidebarMenu>
    );
}
