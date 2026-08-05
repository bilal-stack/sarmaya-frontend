
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useBusinessConceptAssessor } from '@/app/ai-tools/business-concept-assessor/context';

export type ChatRoom = {
    id: string;
    chat_title: string;
    questions: string;
};

type Pagination = {
    last_page: boolean;
    current_page: number;
    continuation_token: string | null;
};

export function BusinessConceptAssessorChatList() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const { activeChat, setActiveChat, refreshCount } = useBusinessConceptAssessor();

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
            let url = `http://localhost:8000/api/v1/business-concept-assessor?page=${page}&per_page=15`;
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
            
            const newChats = result.data.search_result.map((chat: any) => ({
                id: chat.id,
                chat_title: chat.chat_title,
                questions: chat.questions_to_ask || '',
            }));

            setChatRooms(prev => page === 1 ? newChats : [...prev, ...newChats]);
            setPagination(result.data.pagination);

            if (page === 1 && newChats.length > 0 && !activeChat) {
                setActiveChat(newChats[0]);
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
            setChatRooms([]);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [user?.access_token, toast, activeChat, setActiveChat]);
    
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
            {chatRooms.map((chat, index) => {
                 const isLastElement = chatRooms.length === index + 1;
                 return (
                    <SidebarMenuItem 
                        key={chat.id}
                        ref={isLastElement ? lastChatElementRef : null}
                        onClick={() => setActiveChat(chat)}
                    >
                        <SidebarMenuButton isActive={activeChat?.id === chat.id} className="w-full justify-start">
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
