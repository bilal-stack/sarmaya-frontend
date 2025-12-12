
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Circle, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { usePitchDeckAdvisor } from '@/app/ai-tools/pitch-deck-advisor/layout';

type PitchDeck = {
    id: string;
    company_name: string | null;
    document_url: string;
    analysis_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
};

type Pagination = {
    last_page: boolean;
    current_page: number;
    continuation_token: string | null;
};

const StatusIcon = ({ status }: { status: PitchDeck['analysis_status'] }) => {
    const className = "h-3.5 w-3.5";
    switch (status) {
        case 'COMPLETED':
            return <CheckCircle className={`text-green-500 ${className}`} />;
        case 'FAILED':
            return <XCircle className={`text-red-500 ${className}`} />;
        case 'IN_PROGRESS':
            return <Loader2 className={`animate-spin text-blue-500 ${className}`} />;
        case 'PENDING':
            return <Circle className={`text-gray-500 ${className}`} />;
        default:
            return <AlertCircle className={`text-yellow-500 ${className}`} />;
    }
};

const getStatusVariant = (status: PitchDeck['analysis_status']) => {
    switch (status) {
        case 'COMPLETED': return 'default';
        case 'FAILED': return 'destructive';
        default: return 'secondary';
    }
}

export function PitchDeckList() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [pitchDecks, setPitchDecks] = useState<PitchDeck[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const { activeDeckId, setActiveDeckId } = usePitchDeckAdvisor();

    const observer = useRef<IntersectionObserver>();
    
    const fetchPitchDecks = useCallback(async (page = 1, continuationToken: string | null = null) => {
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
            let url = `http://localhost:8000/api/v1/pitch-decks?page=${page}&per_page=10`;
            if (continuationToken) {
                 url += `&continuation_token=${continuationToken}`;
            }
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${user.access_token}` },
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.response_description || 'Failed to fetch pitch decks.');
            }

            const newDecks = result.data.search_result;
            setPitchDecks(prev => page === 1 ? newDecks : [...prev, ...newDecks]);
            setPagination(result.data.pagination);

            if (page === 1 && newDecks.length > 0 && !activeDeckId) {
                setActiveDeckId(newDecks[0].id);
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [user, toast, activeDeckId, setActiveDeckId]);

    const lastDeckElementRef = useCallback((node: HTMLLIElement) => {
        if (isLoading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && pagination && !pagination.last_page) {
                fetchPitchDecks(pagination.current_page + 1, pagination.continuation_token);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, isFetchingMore, pagination, fetchPitchDecks]);

    useEffect(() => {
        fetchPitchDecks(1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on initial mount

    const getDeckName = (deck: PitchDeck) => {
        if (deck.company_name) return deck.company_name;
        try {
            const urlParts = deck.document_url.split('/');
            const fileName = urlParts.pop() || 'Untitled Deck';
            // Decode URI component and remove potential timestamps/UUIDs
            return decodeURIComponent(fileName).replace(/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}_/, '');
        } catch {
            return 'Untitled Deck';
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
            {pitchDecks.map((deck, index) => {
                const isLastElement = pitchDecks.length === index + 1;
                return (
                    <SidebarMenuItem 
                        key={deck.id}
                        ref={isLastElement ? lastDeckElementRef : null}
                        onClick={() => setActiveDeckId(deck.id)}
                    >
                        <SidebarMenuButton isActive={activeDeckId === deck.id} className="w-full justify-between">
                            <span className="truncate">{getDeckName(deck)}</span>
                             <Badge variant={getStatusVariant(deck.analysis_status)} className="flex-shrink-0 gap-1.5">
                                <StatusIcon status={deck.analysis_status} />
                                <span className="hidden group-data-[collapsible=icon]:hidden">{deck.analysis_status}</span>
                             </Badge>
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
            {!isLoading && pitchDecks.length === 0 && (
                <SidebarMenuItem>
                    <p className="p-2 text-xs text-muted-foreground">No pitch decks found.</p>
                </SidebarMenuItem>
            )}
        </SidebarMenu>
    );
}
