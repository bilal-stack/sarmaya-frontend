'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent, ChangeEvent, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Send, Loader2, File as FileIcon, X, Bot, Info, TriangleAlert, FileText, Upload, Link as LinkIcon, ExternalLink, Webhook, Search, Workflow, CheckCircle, Database, Code, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamParser, type ParsedStreamData } from '@/lib/stream-parser';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { DeepResearchToolCard } from '@/components/deep-research-tool-card';
import { parseToolContent, type ToolAction, type SearchResultsData } from '@/components/research-tool-card';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useDeepResearchChatbot } from './context';

type ChatMessage = {
    id?: string;
    sender: 'user' | 'ai';
    text: string;
    fileName?: string;
    parsedData?: ParsedStreamData;
};

type Step = {
    id?: string;
    type: 'step' | 'search' | 'review' | 'tool' | 'finished';
    title: string;
    content?: string | string[];
    tool?: ToolStepData;
};

type Source = {
    url: string;
    domain: string;
    favicon?: string;
};

type ToolStepData = {
    actions: ToolAction[];
    searchResults: SearchResultsData[];
    summary?: string;
};

type WebSearchResult = {
    title?: string;
    url?: string;
    snippet?: string;
    domain?: string;
    favicon_url?: string;
    position?: number;
};

const TOOL_LABELS: Record<string, string> = {
    web_search: 'Web Search',
    database_query: 'Database Query',
    code_execution: 'Code Execution',
};

const getToolActionLabel = (toolName?: string) => {
    if (!toolName) return 'Tool Execution';
    const normalized = toolName.toLowerCase();
    return TOOL_LABELS[normalized] ?? toolName.replace(/_/g, ' ');
};

const getToolActionIcon = (toolName?: string) => {
    switch (toolName?.toLowerCase()) {
        case 'web_search':
            return Search;
        case 'database_query':
            return Database;
        case 'code_execution':
            return Code;
        default:
            return Globe;
    }
};

const formatActionStatus = (status?: ToolAction['status']) => {
    switch (status) {
        case 'running':
            return 'Running';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'error':
            return 'Error';
        default:
            return 'Pending';
    }
};

const getActionStatusBadgeVariant = (status?: ToolAction['status']) => {
    switch (status) {
        case 'completed':
            return 'secondary';
        case 'failed':
        case 'error':
            return 'destructive';
        default:
            return 'outline';
    }
};

const extractToolInputValue = (toolInput: unknown): string | undefined => {
    if (toolInput === null || toolInput === undefined) return undefined;
    if (typeof toolInput === 'string') return toolInput;
    if (typeof toolInput === 'number' || typeof toolInput === 'boolean') {
        return String(toolInput);
    }
    if (Array.isArray(toolInput)) {
        return toolInput
            .map((item) => (typeof item === 'string' ? item : ''))
            .filter(Boolean)
            .join(', ');
    }
    if (typeof toolInput === 'object') {
        const possibleKeys = ['query', 'question', 'prompt', 'input', 'text', 'url', '__arg1'];
        for (const key of possibleKeys) {
            const value = (toolInput as Record<string, unknown>)[key];
            if (typeof value === 'string') return value;
        }
        try {
            return JSON.stringify(toolInput);
        } catch {
            return undefined;
        }
    }
    return undefined;
};

const stripToolMarkers = (text: string) =>
    text
        .replace(/\[\/?ACTION\]/g, '')
        .replace(/\[\/?SEARCH_RESULTS\]/g, '')
        .replace(/\[\/?TOOL_START\]/g, '')
        .replace(/\[\/?TOOL_END\]/g, '')
        .trim();

const isLikelyJson = (text: string) => {
    const trimmed = text.trim();
    return (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
};

// Global summary sanitizer used for incremental tool parsing and rendering
const sanitizeSummary = (text?: string) => {
    if (!text) return undefined;
    const cleaned = text
        .replace(/\[(?:ACTION|\/ACTION|SEARCH_RESULTS|\/SEARCH_RESULTS|TOOL_START|TOOL_END)\]/g, '')
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim();
    if (!cleaned || cleaned.length < 5) return undefined;
    if (/^\{\s*"/.test(cleaned)) return undefined; // raw JSON blob
    return cleaned;
};

const ActionDetail = ({ action }: { action: ToolAction }) => {
    if (!action?.tool_name) return null;
    const Icon = getToolActionIcon(action.tool_name);

    return (
        <div className="flex items-start gap-3 rounded-md border border-border/60 bg-background/80 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{getToolActionLabel(action.tool_name)}</p>
                {action.tool_input && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{action.tool_input}</p>
                )}
            </div>
            <Badge variant={getActionStatusBadgeVariant(action.status)} className="text-xs capitalize">
                {formatActionStatus(action.status)}
            </Badge>
        </div>
    );
};

const SearchResultItem = ({ result }: { result: WebSearchResult }) => {
    if (!result?.url) return null;

    let domain = result.domain;
    if (!domain) {
        try {
            domain = new URL(result.url).hostname;
        } catch {
            domain = result.url;
        }
    }

    return (
        <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-border/60 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-background"
        >
            <div className="flex items-start gap-3">
                <div className="mt-1 shrink-0">
                    {result.favicon_url ? (
                        <img
                            src={result.favicon_url}
                            alt=""
                            className="h-5 w-5 rounded"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <Globe className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {typeof result.position === 'number' && (
                            <Badge variant="outline" className="text-xs">
                                #{result.position}
                            </Badge>
                        )}
                        <span className="truncate">{domain}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{result.title || result.url}</p>
                    {result.snippet && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                    )}
                </div>
                <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
        </a>
    );
};

const SearchResultsBlock = ({ block }: { block: SearchResultsData }) => {
    const results = Array.isArray(block.results) ? (block.results as WebSearchResult[]).slice(0, 6) : [];
    if (!block.featured_snippet && results.length === 0) {
        return null;
    }

    const total = typeof block.total_results === 'number' ? block.total_results : results.length;

    return (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Search className="h-4 w-4" />
                    <span>{block.query || 'Search Results'}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                    {total} result{total === 1 ? '' : 's'}
                </Badge>
            </div>
            {block.featured_snippet && (
                <div className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                    {block.featured_snippet}
                </div>
            )}
            <div className="space-y-3">
                {results.map((result, index) => (
                    <SearchResultItem key={`${result.url || 'result'}-${index}`} result={result} />
                ))}
            </div>
        </div>
    );
};

const ToolStepContent = ({ tool }: { tool: ToolStepData }) => {
    const actions = Array.isArray(tool.actions) ? tool.actions : [];
    const searchResults = Array.isArray(tool.searchResults) ? tool.searchResults : [];
    const summary = sanitizeSummary(tool.summary);

    const hasActions = actions.length > 0;
    const hasSearchResults = searchResults.some((block) => (
        Array.isArray(block.results) && block.results.length > 0
    ) || Boolean(block.featured_snippet));
    const hasSummary = Boolean(summary);

    if (!hasActions && !hasSearchResults && !hasSummary) {
        return null;
    }

    return (
        <div className="mt-3 space-y-4 rounded-lg border border-border/50 bg-background/80 p-4">
            {hasSummary && (
                <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary!}</ReactMarkdown>
                </div>
            )}
            {hasActions && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
                    <div className="space-y-3">
                        {actions.map((action, index) => (
                            <ActionDetail
                                key={`${action.tool_name || 'tool'}-${index}-${action.tool_input}`}
                                action={action}
                            />
                        ))}
                    </div>
                </div>
            )}
            {hasSearchResults && (
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search Results</p>
                    <div className="space-y-4">
                        {searchResults.map((block, index) => (
                            <SearchResultsBlock key={`${block.query || 'search'}-${index}`} block={block} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StepsPanel = ({ steps }: { steps: Step[] }) => {
    const getIcon = (type: Step['type']) => {
        switch (type) {
            case 'step':
                return <Workflow className="h-5 w-5 text-primary" />;
            case 'search':
                return <Search className="h-5 w-5 text-blue-400" />;
            case 'review':
                return <FileText className="h-5 w-5 text-purple-400" />;
            case 'tool':
                return <Webhook className="h-5 w-5 text-orange-400" />;
            case 'finished':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            default:
                return <Workflow className="h-5 w-5 text-primary" />;
        }
    };

    return (
        <ScrollArea className="flex-1 p-6">
            <div className="relative">
                {/* Vertical line */}
                {steps.length > 1 && <div className="absolute left-4 top-0 h-full w-0.5 -translate-x-1/2 bg-border" />}

                <div className="space-y-8">
                    {steps.map((step, index) => (
                        <div key={step.id ?? index} className="relative flex items-start gap-4">
                            <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-card">
                                {getIcon(step.type)}
                            </div>
                            <div className="flex-1 pt-1.5">
                                <h4 className="font-semibold">{step.title}</h4>
                                {step.type === 'tool' && step.tool && <ToolStepContent tool={step.tool} />}
                                {step.type === 'search' && Array.isArray(step.content) && (
                                    <div className="mt-2 space-y-2">
                                        {step.content.map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                                                <Search className="h-4 w-4" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {step.type === 'review' && Array.isArray(step.content) && (
                                    <div className="mt-2 space-y-2">
                                        {step.content.map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                                                <FileText className="h-4 w-4" />
                                                <span className="truncate">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {step.type === 'step' && typeof step.content === 'string' && (
                                    <p className="mt-1 text-sm text-muted-foreground">{step.content}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ScrollArea>
    );
};

const SourcesPanel = ({ sources }: { sources: Source[] }) => {
    return (
        <ScrollArea className="flex-1 p-6">
            <div className="space-y-3">
                {sources.map((source, index) => (
                    <a 
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                    >
                         <Avatar className="h-5 w-5">
                            <AvatarImage src={source.favicon} alt={source.domain} />
                            <AvatarFallback><LinkIcon className="h-3 w-3" /></AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground break-all">{source.domain}</span>
                        <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
                    </a>
                ))}
                {sources.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center pt-4">Sources will appear here as they are found.</p>
                )}
            </div>
        </ScrollArea>
    );
};

const LeftPanel = ({ steps, sources }: { steps: Step[]; sources: Source[] }) => {
    return (
        <div className="flex h-full flex-col">
            <Tabs defaultValue="steps" className="flex flex-col h-full">
                <div className="flex h-14 items-center border-b px-4">
                    <TabsList>
                        <TabsTrigger value="steps" className="flex items-center gap-2">
                            <Workflow /> Steps
                        </TabsTrigger>
                        <TabsTrigger value="sources" className="flex items-center gap-2">
                            <LinkIcon /> Sources
                            {sources.length > 0 && <Badge variant="secondary" className="ml-1">{sources.length}</Badge>}
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="steps" className="flex-grow overflow-auto">
                    <StepsPanel steps={steps} />
                </TabsContent>
                <TabsContent value="sources" className="flex-grow overflow-auto">
                    <SourcesPanel sources={sources} />
                </TabsContent>
            </Tabs>
        </div>
    );
};


const WelcomeCard = () => (
    <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center bg-card/50">
            <CardHeader>
                 <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Bot className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Welcome to the Deep Research Chatbot</CardTitle>
                <CardDescription>
                    How can I help you with your deep research needs today?
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
);


const ChatPanel = ({
    isSending,
    handleSendMessage,
    chatHistory,
    analysisProgress,
    chatTitle
}: {
    isSending: boolean;
    handleSendMessage: (message?: string, file?: File) => void;
    chatHistory: ChatMessage[];
    analysisProgress: string;
    chatTitle: string;
}) => {
    const [message, setMessage] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleLocalSendMessage();
        }
    };
    
    const handleLocalSendMessage = () => {
        handleSendMessage(message, attachedFile || undefined);
        setMessage('');
        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          setAttachedFile(file);
        }
    };
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isSending]);

    return (
         <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <h3 className="text-lg font-semibold truncate">{chatTitle || "Deep Research"}</h3>
            </div>

            {chatHistory.length === 0 && !isSending ? (
                <WelcomeCard />
            ) : (
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-6">
                    {chatHistory.map((chat, index) => {
                        const isLastMessage = index === chatHistory.length - 1;
                        const isStreaming = chat.sender === 'ai' && isSending && isLastMessage;
                        return (
                        <div key={chat.id || index} className={`flex w-full items-start gap-4 ${chat.sender === 'user' ? 'justify-end' : ''}`}>
                            {chat.sender === 'ai' && (
                                <Avatar>
                                    <AvatarImage src="https://picsum.photos/seed/ai-deepresearch/40/40" />
                                    <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`prose prose-sm prose-invert max-w-none relative group rounded-lg p-3 ${chat.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {isStreaming && !chat.text ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <p className="text-sm">{analysisProgress || 'Thinking...'}</p>
                                    </div>
                                ) : (
                                    <AiMessageContent content={chat.parsedData} isStreaming={isStreaming} fullText={chat.text} />
                                )}

                                {chat.fileName && (
                                    <div className="not-prose mt-2 flex items-center gap-2 rounded-md border border-white/20 bg-black/20 p-2 text-sm text-white">
                                        <FileIcon className="h-4 w-4" />
                                        <span>{chat.fileName}</span>
                                    </div>
                                )}
                            </div>
                            {chat.sender === 'user' && (
                                <Avatar>
                                    <AvatarImage src="https://picsum.photos/seed/user-avatar/40/40" />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    )})}
                    <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
            )}
             <div className="border-t bg-background p-4">
                 {attachedFile && (
                    <div className="mb-2 flex items-center justify-between rounded-md border bg-muted/50 p-2">
                        <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{attachedFile.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setAttachedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <div className="relative">
                <Textarea
                    placeholder="Ask about deep research..."
                    className="pr-24"
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                />
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending}
                        title="Upload a file"
                    >
                        <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                        type="submit"
                        size="icon"
                        onClick={handleLocalSendMessage}
                        disabled={isSending || (!message.trim() && !attachedFile)}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                </div>
            </div>
        </div>
    )
}

const Callout = ({ type, children }: { type: string; children: ReactNode }) => {
    const Icon = type === 'info' ? Info : TriangleAlert;
    const colorClass = type === 'info' ? 'bg-blue-900/30 border-blue-500' : 'bg-yellow-900/30 border-yellow-500';
    const contentString = typeof children === 'string' ? children : undefined;

    return (
        <div className={`not-prose my-4 rounded-md border-l-4 p-4 ${colorClass}`}>
            <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${type === 'info' ? 'text-blue-400' : 'text-yellow-400'}`} />
                {contentString ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm prose-invert max-w-none">
                        {contentString}
                    </ReactMarkdown>
                ) : (
                    <div className="text-sm">{children}</div>
                )}
            </div>
        </div>
    );
};

const TableRenderer = ({ content }: { content: string }) => {
    return (
        <div className="prose prose-sm prose-invert max-w-none my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: new StreamParser().renderTableToHtml(content) }} />
    );
};

const ActionDisplay = ({ action }: { action: any }) => {
    if (action.type !== 'action_insight' || !action.action_detail) return null;

    const { tool_name, tool_input } = action.action_detail;

    if (tool_name === 'web_search') {
        return (
            <div className="not-prose my-2 flex items-center gap-2 text-sm p-2 rounded-md flash-animation">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Searching for: "{tool_input}"</span>
            </div>
        );
    }
    return null;
}

const AiMessageContent = ({ content, isStreaming, fullText }: { content?: ParsedStreamData, isStreaming: boolean, fullText: string }) => {
    const renderParts = () => {
        if (!content?.parts) {
            return null;
        }

        return (
            <div className="prose prose-sm prose-invert max-w-none">
                {content.parts.map((part, index) => {
                    switch (part.type) {
                        case 'text':
                            return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
                        case 'table':
                            return <TableRenderer key={index} content={part.content} />;
                        case 'code':
                            return (
                                 <pre key={index} className="bg-gray-800 p-2 rounded-md text-white text-sm overflow-x-auto">
                                    <code>{part.content}</code>
                                </pre>
                            );
                        case 'callout':
                            return <Callout key={index} type={part.calloutType || 'info'}>{part.content}</Callout>
                        case 'diagram':
                            return <MermaidDiagram key={index} chart={part.content} />;
                        case 'math':
                            return (
                                <div key={index} className="not-prose my-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                                    <p className="font-mono text-lg leading-relaxed text-primary">
                                        {part.content}
                                    </p>
                                </div>
                            );
                        case 'action':
                            return <ActionDisplay key={index} action={part.content} />;
                        case 'tool':
                            return <DeepResearchToolCard key={index} content={part.content} />;
                        case 'questions':
                            return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
                        case 'search_results':
                            return null;
                        case 'divider':
                            return <hr key={index} className="my-4 border-border" />;
                        default:
                            return null;
                    }
                })}
            </div>
        );
    };

    // During streaming, we directly render the accumulated text for smoothness.
    if (isStreaming) {
        if (content?.parts && content.parts.length > 0) {
            return renderParts();
        }
        const cleanedText = new StreamParser().cleanStreamingText(fullText);
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanedText}</ReactMarkdown>;
    }
    // After streaming, if we have parsed parts, render them structured.
    if (!content?.parts) {
        const cleanedText = new StreamParser().cleanStreamingText(fullText);
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanedText}</ReactMarkdown>;
    }
    
    return renderParts();
};


export default function DeepResearchChatbotPage() {
  const [isSending, setIsSending] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatTitle, setChatTitle] = useState('Deep Research');
  const [steps, setSteps] = useState<Step[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
    const { user } = useAuth();
    const { toast } = useToast();
    const { activeChatId, setActiveChatId, refreshChatList } = useDeepResearchChatbot();
    const isNewChatSession = useRef(true);
        const seenSourceUrlsRef = useRef<Set<string>>(new Set());
        const shouldSkipNextHistoryFetch = useRef(false);

  const runAnalysisAnimation = useCallback(() => {
    const steps = [
      "Initiating deep research protocol...",
      "Scanning vast data repositories...",
      "Synthesizing information from multiple sources...",
      "Cross-validating findings...",
      "Constructing a comprehensive response...",
      "Finalizing in-depth analysis..."
    ];
    let currentStep = 0;
    
    const interval = setInterval(() => {
        setAnalysisProgress(steps[currentStep]);
        currentStep = (currentStep + 1) % steps.length;
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const parseStepContent = (content: string): Step => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const title = lines[0] || "Processing...";

    if (title.toLowerCase().startsWith('searching')) {
        const queries = lines.slice(1).map(line => line.replace(/^- /, ''));
        return { type: 'search', title: 'Searching', content: queries };
    }
    if (title.toLowerCase().startsWith('reviewing sources')) {
        const urls = lines.slice(1).map(line => line.replace(/^- /, ''));
        const newSources: Source[] = urls.map(url => {
            try {
                const domain = new URL(url).hostname;
                return { url, domain, favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` };
            } catch {
                return { url, domain: url };
            }
        });
        setSources(prev => {
            const existingUrls = new Set(prev.map(s => s.url));
            const uniqueNewSources = newSources.filter(s => !existingUrls.has(s.url));
            if (uniqueNewSources.length) {
                uniqueNewSources.forEach(source => seenSourceUrlsRef.current.add(source.url));
            }
            return [...prev, ...uniqueNewSources];
        });
        return { type: 'review', title: 'Reviewing Sources', content: urls };
    }
     if (title.toLowerCase().startsWith('finished')) {
        return { type: 'finished', title: 'Finished' };
    }

    return { type: 'step', title };
};

 const handleStreamedResponse = async (response: Response, aiMessageId: string) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Could not read response stream.");
    const decoder = new TextDecoder();
    const parser = new StreamParser();
    
    let fullAiResponse = '';
    // Accumulate raw tool block content during streaming for richer parsing
    let toolBlockBuffer = '';
    let activeToolStepId: string | null = null;

    type MutableToolState = {
        actions: ToolAction[];
        searchResults: SearchResultsData[];
        summaryLines: string[];
    };

    let isInsideTool = false;
    let currentToolStepId: string | null = null;
    let currentToolState: MutableToolState | null = null;

    const ensureToolState = () => {
        if (!currentToolState) {
            currentToolState = { actions: [], searchResults: [], summaryLines: [] };
        }
        isInsideTool = true;
    };

    const parseAndUpdateToolStepFromBuffer = () => {
        const trimmed = toolBlockBuffer.trim();
        if (!trimmed) return;
        // Incremental parsing: extract complete ACTION / SEARCH_RESULTS JSON even if closing tags not yet present
        const actions: ToolAction[] = [];
        const searchResults: SearchResultsData[] = [];
        let workingContent = trimmed;

        // Helper to extract blocks by start marker and balanced JSON object
        const extractBlocks = (marker: string, pushFn: (obj: any)=>void) => {
            let idx = workingContent.indexOf(marker);
            while (idx !== -1) {
                const after = workingContent.slice(idx + marker.length);
                // find first '{'
                const braceStart = after.indexOf('{');
                if (braceStart === -1) break;
                let depth = 0; let inString = false; let escape = false; let endPos = -1;
                for (let i = braceStart; i < after.length; i++) {
                    const ch = after[i];
                    if (inString) {
                        if (ch === '"' && !escape) inString = false;
                        escape = ch === '\\' && !escape;
                    } else {
                        if (ch === '"') inString = true;
                        if (ch === '{') depth++;
                        else if (ch === '}') depth--;
                    }
                    if (!inString && depth === 0 && i > braceStart) { endPos = i; break; }
                }
                if (endPos === -1) break; // incomplete JSON, wait for more data
                const jsonString = after.slice(braceStart, endPos + 1);
                try {
                    const obj = JSON.parse(jsonString);
                    pushFn(obj);
                } catch { /* ignore parse errors until complete */ }
                // Remove processed segment (including marker + json) from workingContent to avoid duplication in summary
                workingContent = workingContent.slice(0, idx) + workingContent.slice(idx + marker.length + braceStart + endPos + 1);
                idx = workingContent.indexOf(marker);
            }
        };

        extractBlocks('[ACTION]', (obj) => {
            if (obj && obj.action_detail && typeof obj.action_detail.tool_name === 'string') {
                actions.push({
                    tool_name: obj.action_detail.tool_name,
                    tool_input: extractToolInputValue(obj.action_detail.tool_input),
                    status: 'completed'
                });
            }
        });
        extractBlocks('[SEARCH_RESULTS]', (obj) => {
            if (obj && typeof obj.query === 'string' && Array.isArray(obj.results)) {
                searchResults.push({
                    query: obj.query,
                    search_engine: typeof obj.search_engine === 'string' ? obj.search_engine : '',
                    total_results: typeof obj.total_results === 'number' ? obj.total_results : obj.results.length,
                    results: obj.results,
                    featured_snippet: obj.featured_snippet
                });
            }
        });

        // Fall back to full parser once closing tags appear to refine summary (more accurate extraction & cleanup)
        let summary = '';
        if (workingContent.includes('[TOOL_END]')) {
            const parsed = parseToolContent(workingContent);
            // Merge parser-found actions/searchResults avoiding duplicates
            parsed.actions.forEach(a => {
                if (!actions.find(x => x.tool_name === a.tool_name && x.tool_input === a.tool_input)) actions.push(a);
            });
            parsed.searchResults.forEach(sr => {
                if (!searchResults.find(x => x.query === sr.query && x.search_engine === sr.search_engine)) searchResults.push(sr);
            });
            summary = parsed.remainingContent.trim();
        } else {
            // Remove any dangling markers from summary to prevent raw display
            summary = workingContent
                .replace(/\[ACTION\]/g,'')
                .replace(/\[\/ACTION\]/g,'')
                .replace(/\[SEARCH_RESULTS\]/g,'')
                .replace(/\[\/SEARCH_RESULTS\]/g,'')
                .replace(/\[TOOL_START\]/g,'')
                .replace(/\[TOOL_END\]/g,'')
                .trim();
        }

        const sanitizedSummary = sanitizeSummary(summary);
        const hasContent = actions.length || searchResults.length || sanitizedSummary;
        if (!hasContent) return;
        // Build ToolStepData structure for rendering
        const toolData: ToolStepData = {
            actions: actions.map(a => ({ ...a })),
            searchResults: searchResults.map(sr => ({ ...sr, results: Array.isArray(sr.results) ? sr.results.slice() : [] })),
            summary: sanitizedSummary || undefined,
        };
        // Title preference: search query > last action > fallback
        const title = searchResults[0]?.query
            ? `Search: ${searchResults[0].query}`
            : actions[actions.length - 1]?.tool_name
                ? getToolActionLabel(actions[actions.length - 1].tool_name)
                : 'Tool Execution';

        setSteps(prev => {
            if (activeToolStepId) {
                return prev.map(step => step.id === activeToolStepId ? { ...step, title, tool: toolData } : step);
            }
            const newId = `tool-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
            activeToolStepId = newId;
            return [...prev, { id: newId, type: 'tool', title, tool: toolData }];
        });

        // Realtime source extraction from parsed search results
        const newSources: Source[] = [];
        searchResults.forEach(block => {
            if (!Array.isArray(block.results)) return;
            (block.results as WebSearchResult[]).forEach(r => {
                if (!r.url || seenSourceUrlsRef.current.has(r.url)) return;
                seenSourceUrlsRef.current.add(r.url);
                let domain = r.domain || r.url;
                if (!r.domain) {
                    try { domain = new URL(r.url).hostname; } catch { domain = r.url; }
                }
                newSources.push({ url: r.url, domain, favicon: r.favicon_url });
            });
        });
        if (newSources.length) {
            setSources(prev => [...prev, ...newSources]);
        }
    };

    const cloneToolData = (): ToolStepData | null => {
        if (!currentToolState) return null;
        const summaryText = currentToolState.summaryLines.join('\n').trim();
        return {
            actions: currentToolState.actions.map(action => ({ ...action })),
            searchResults: currentToolState.searchResults.map(block => ({
                ...block,
                results: Array.isArray(block.results)
                    ? block.results.map(result => ({ ...result }))
                    : [],
            })),
            summary: summaryText ? summaryText : undefined,
        };
    };

    const computeToolStepTitle = (toolData: ToolStepData) => {
        const searchWithQuery = toolData.searchResults.find(block => block.query);
        if (searchWithQuery?.query) {
            return `Search: ${searchWithQuery.query}`;
        }
        const lastAction = toolData.actions[toolData.actions.length - 1];
        if (lastAction?.tool_name) {
            return getToolActionLabel(lastAction.tool_name);
        }
        return 'Tool Execution';
    };

    const pushToolStepUpdate = () => {
        const toolData = cloneToolData();
        if (!toolData) return;
        const hasContent = toolData.actions.length > 0 || toolData.searchResults.length > 0 || !!toolData.summary;
        if (!hasContent) return;

        const title = computeToolStepTitle(toolData);

        if (currentToolStepId) {
            setSteps(prev =>
                prev.map(step =>
                    step.id === currentToolStepId
                        ? {
                            ...step,
                            title,
                            tool: toolData,
                        }
                        : step
                )
            );
        } else {
            const newToolStepId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            currentToolStepId = newToolStepId;
            setSteps(prev => [
                ...prev,
                {
                    // Local const, so its type is string rather than the
                    // outer variable's string | null, which Step.id rejects.
                    id: newToolStepId,
                    type: 'tool',
                    title,
                    tool: toolData,
                },
            ]);
        }
    };

    const upsertAction = (action: ToolAction) => {
        if (!action.tool_name) return;
        ensureToolState();
        const normalizedAction: ToolAction = {
            tool_name: action.tool_name,
            tool_input: action.tool_input,
            status: action.status || 'completed',
        };
        const existingIndex = currentToolState!.actions.findIndex(
            existing =>
                existing.tool_name === normalizedAction.tool_name &&
                existing.tool_input === normalizedAction.tool_input
        );
        if (existingIndex !== -1) {
            currentToolState!.actions[existingIndex] = {
                ...currentToolState!.actions[existingIndex],
                ...normalizedAction,
            };
        } else {
            currentToolState!.actions.push(normalizedAction);
        }
        pushToolStepUpdate();
    };

    const upsertSearchResults = (searchData: SearchResultsData) => {
        ensureToolState();
        const normalized: SearchResultsData = {
            ...searchData,
            results: Array.isArray(searchData.results) ? searchData.results : [],
        };
        const key = `${normalized.query || ''}|${normalized.search_engine || ''}`;
        const existingIndex = currentToolState!.searchResults.findIndex(
            block => `${block.query || ''}|${block.search_engine || ''}` === key
        );
        if (existingIndex !== -1) {
            currentToolState!.searchResults[existingIndex] = normalized;
        } else {
            currentToolState!.searchResults.push(normalized);
        }

        if (Array.isArray(normalized.results)) {
            const newSources: Source[] = [];
            normalized.results.forEach((result: WebSearchResult) => {
                if (!result?.url || seenSourceUrlsRef.current.has(result.url)) return;
                seenSourceUrlsRef.current.add(result.url);
                let domain = result.domain || result.url;
                if (!result.domain) {
                    try {
                        domain = new URL(result.url).hostname;
                    } catch {
                        domain = result.url;
                    }
                }
                newSources.push({
                    url: result.url,
                    domain,
                    favicon: result.favicon_url,
                });
            });
            if (newSources.length > 0) {
                setSources(prev => [...prev, ...newSources]);
            }
        }

        pushToolStepUpdate();
    };

    const appendSummaryText = (rawChunk: string) => {
        const cleaned = stripToolMarkers(rawChunk).trim();
        if (!cleaned) return;
        if (isLikelyJson(cleaned)) return;
        ensureToolState();
        currentToolState!.summaryLines.push(cleaned);
        pushToolStepUpdate();
    };

    const handleToolEventPayload = (payload: any) => {
        if (!payload || typeof payload !== 'object') return;

        const actionDetails: any[] = [];

        if (payload.action_detail && typeof payload.action_detail === 'object') {
            actionDetails.push(payload.action_detail);
        }
        if (Array.isArray(payload.action_details)) {
            payload.action_details.forEach((detail: unknown) => {
                if (detail && typeof detail === 'object') {
                    actionDetails.push(detail);
                }
            });
        }
        if (typeof payload.tool_name === 'string') {
            actionDetails.push({
                tool_name: payload.tool_name,
                tool_input: payload.tool_input,
                status: payload.status,
            });
        }

        actionDetails.forEach((detail) => {
            if (!detail || typeof detail !== 'object') return;
            const toolName = typeof detail.tool_name === 'string' ? detail.tool_name : undefined;
            if (!toolName) return;
            const toolInput = extractToolInputValue(detail.tool_input);
            const status = typeof detail.status === 'string' ? (detail.status as ToolAction['status']) : 'completed';
            upsertAction({
                tool_name: toolName,
                tool_input: toolInput,
                status,
            });
        });

        const resultCandidates: any[] = [];
        if (Array.isArray((payload as any).results)) {
            resultCandidates.push(payload);
        }
        if (payload.search_results && typeof payload.search_results === 'object' && Array.isArray(payload.search_results.results)) {
            resultCandidates.push({
                ...payload.search_results,
                search_engine: payload.search_results.search_engine ?? payload.search_engine,
            });
        }
        if (payload.searchResults && typeof payload.searchResults === 'object' && Array.isArray(payload.searchResults.results)) {
            resultCandidates.push({
                ...payload.searchResults,
                search_engine: payload.searchResults.search_engine ?? payload.search_engine,
            });
        }
        if (payload.data && typeof payload.data === 'object' && Array.isArray((payload.data as any).results)) {
            resultCandidates.push({
                ...payload.data,
                search_engine: payload.data.search_engine ?? payload.search_engine,
            });
        }

        resultCandidates.forEach((block) => {
            if (!block || typeof block !== 'object') return;
            upsertSearchResults({
                query: typeof block.query === 'string' ? block.query : '',
                search_engine: typeof block.search_engine === 'string' ? block.search_engine : '',
                total_results: typeof block.total_results === 'number'
                    ? block.total_results
                    : Array.isArray(block.results)
                        ? block.results.length
                        : 0,
                results: Array.isArray(block.results) ? block.results : [],
                featured_snippet: block.featured_snippet,
            });
        });

        if (payload.payload && typeof payload.payload === 'object' && payload.payload !== payload) {
            handleToolEventPayload(payload.payload);
        }
        if (payload.data && typeof payload.data === 'object' && payload.data !== payload) {
            handleToolEventPayload(payload.data);
        }
        if (typeof payload.message === 'string') {
            appendSummaryText(payload.message);
        }
    };

    const finalizeCurrentTool = () => {
        if (!isInsideTool) return;
        pushToolStepUpdate();
        isInsideTool = false;
        currentToolStepId = null;
        currentToolState = null;
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        parser.parse(chunk, (data) => {
            if (data.type !== 'tool' && isInsideTool) {
                // Finalize buffer-driven tool step before leaving tool state
                parseAndUpdateToolStepFromBuffer();
                finalizeCurrentTool();
                toolBlockBuffer = '';
                activeToolStepId = null;
            }

             if (data.type === 'metadata') {
                if (data.has_new_chat_created && data.chatroom_id) {
                    if (isNewChatSession.current) {
                        shouldSkipNextHistoryFetch.current = true;
                        setActiveChatId(data.chatroom_id);
                        refreshChatList();
                        isNewChatSession.current = false;
                    }
                }
                if (data.chat_title) {
                    setChatTitle(data.chat_title);
                }
            } else if ((data.type === 'content' || data.type === 'questions' || data.type === 'math') && data.chunk) {
                fullAiResponse += data.chunk;
                if (data.type === 'questions') fullAiResponse += '\n';
                const intermediateParsed = parser.parseContent(fullAiResponse);
                setChatHistory(prev =>
                    prev.map(chat =>
                        chat.id === aiMessageId ? { ...chat, text: fullAiResponse, parsedData: { type: 'content', parts: intermediateParsed } } : chat
                    )
                );
            } else if (data.type === 'steps' && data.chunk) {
                // Skip JSON content in steps - those are handled as tool events
                const trimmedChunk = data.chunk.trim();
                if (!trimmedChunk.startsWith('{') && !trimmedChunk.startsWith('[')) {
                    const newStep = parseStepContent(data.chunk);
                    setSteps(prev => [...prev, newStep]);
                }
            } else if (data.type === 'action' && data.content) {
                 setChatHistory(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if(lastMsg.id === aiMessageId) {
                        const newParts = [...(lastMsg.parsedData?.parts || []), { type: 'action' as const, content: data.content }];
                        return prev.map(chat => chat.id === aiMessageId ? { ...chat, parsedData: { type: 'content', parts: newParts } } : chat);
                    }
                    return prev;
                 });
            } else if (data.type === 'tool') {
                // Accumulate raw tool block content (markers stripped at parseToolContent)
                if (data.subType === 'text' && data.chunk) {
                    toolBlockBuffer += data.chunk;
                } else if (!data.subType) {
                    // JSON payload inside tool block: only store relevant fields (strip parser metadata)
                    const minimal: any = {};
                    if (data.action_detail) minimal.action_detail = data.action_detail;
                    if (data.action_details) minimal.action_details = data.action_details;
                    if (data.tool_name) minimal.tool_name = data.tool_name;
                    if (data.tool_input) minimal.tool_input = data.tool_input;
                    if (data.query) minimal.query = data.query;
                    if (data.search_engine) minimal.search_engine = data.search_engine;
                    if (data.total_results !== undefined) minimal.total_results = data.total_results;
                    if (data.results) minimal.results = data.results;
                    if (data.featured_snippet) minimal.featured_snippet = data.featured_snippet;
                    if (Object.keys(minimal).length) {
                        toolBlockBuffer += (toolBlockBuffer.endsWith('\n') || toolBlockBuffer === '' ? '' : ' ') + JSON.stringify(minimal);
                    }
                }
                // Process JSON for actions & search results to keep step responsive
                if (data.action_detail || data.query || data.results || data.tool_name) {
                    handleToolEventPayload(data);
                }
                if (data.content && typeof data.content === 'object') {
                    handleToolEventPayload(data.content);
                }
                // Re-parse full buffer for structured rendering after each addition
                parseAndUpdateToolStepFromBuffer();
            }
        });
    }

    finalizeCurrentTool();
    // Ensure any trailing buffered content is parsed
    parseAndUpdateToolStepFromBuffer();

    // Clean the full response and parse it
    const cleanedResponse = parser.getFinalContent(fullAiResponse);
    const finalParsedContent = parser.parseContent(fullAiResponse);
    setChatHistory(prev =>
        prev.map(chat =>
            chat.id === aiMessageId
                ? { ...chat, text: cleanedResponse, parsedData: { type: 'content', parts: finalParsedContent } }
                : chat
        )
    );
};

  const handleSendMessage = async (message?: string, file?: File) => {
    const messageToSend = message || '';
    if (!messageToSend.trim() && !file) return;

    if (isNewChatSession.current) {
        setSteps([]);
        setSources([]);
        seenSourceUrlsRef.current.clear();
    }

    const userMessage: ChatMessage = { sender: 'user', text: messageToSend, id: `user-${Date.now()}` };
    if (file) userMessage.fileName = file.name;
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessagePlaceholder: ChatMessage = { 
        id: aiMessageId, 
        sender: 'ai', 
        text: '',
        parsedData: { type: 'content', parts: [] } 
    };

    setChatHistory(prev => [...prev, userMessage, aiMessagePlaceholder]);
    if (isNewChatSession.current) {
        setSteps([{type: 'step', title: 'Investigating...', content: messageToSend}]);
    }
    
    setIsSending(true);
    const stopAnimation = runAnalysisAnimation();

    if (!user?.access_token) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        setIsSending(false);
        stopAnimation();
        return;
    }

    const formData = new FormData();
    formData.append('message', messageToSend);
    if(file) formData.append('file', file);
    
    if (activeChatId && !isNewChatSession.current) {
        formData.append('drc_chat_id', activeChatId);
    }

    try {
        const response = await fetch('http://localhost:8000/api/v1/deep-research-chatbot/chat', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.access_token}` },
            body: formData,
        });

        if (!response.ok || !response.body) {
            const errorResult = await response.json().catch(() => ({ response_description: 'API request failed' }));
            throw new Error(errorResult.response_description);
        }

        await handleStreamedResponse(response, aiMessageId);

    } catch (error: any) {
        const errorResponse: ChatMessage = { 
            id: aiMessageId, 
            sender: 'ai', 
            text: error.message || "I encountered an error. Please try again.",
            parsedData: {
                type: 'content',
                parts: [{ type: 'text', content: error.message || "I encountered an error. Please try again." }]
            }
        };
        setChatHistory(prev => prev.map(c => c.id === aiMessageId ? errorResponse : c));
        toast({
            variant: "destructive",
            title: "API Error",
            description: error.message || "Failed to get a response from the chatbot."
        });
    } finally {
        stopAnimation();
        setIsSending(false);
        setAnalysisProgress('');
    }
  };

const processHistoryItem = (item: any): { chatMessages: ChatMessage[], steps: Step[], sources: Source[] } => {
    const historyChatMessages: ChatMessage[] = [];
    const historySteps: Step[] = [];
    const historySources: Source[] = [];
    const parser = new StreamParser();

    historyChatMessages.push({
        id: `user-${item.id}`,
        sender: 'user',
        text: item.user_message,
        fileName: item.attachment
    });
    
    const finalContent = parser.getFinalContent(item.ai_response);
    const parsedData = parser.parseContent(finalContent);

    historyChatMessages.push({
        id: `ai-${item.id}`,
        sender: 'ai',
        text: finalContent,
        parsedData: { type: 'content', parts: parsedData }
    });

    const stepRegex = /STEP_START([\s\S]*?)STEP_END/g;
    let match;
    while ((match = stepRegex.exec(item.ai_response)) !== null) {
        const stepContent = match[1].trim();
        historySteps.push(parseStepContent(stepContent));
    }

    const historySourceUrls = new Set<string>();

    const addSourcesFromResults = (searchResults: SearchResultsData[]) => {
        searchResults.forEach((block) => {
            if (!Array.isArray(block.results)) return;
            block.results.forEach((res: WebSearchResult) => {
                if (!res?.url || historySourceUrls.has(res.url)) return;
                historySourceUrls.add(res.url);
                let domain = res.domain || res.url;
                if (!res.domain) {
                    try {
                        domain = new URL(res.url).hostname;
                    } catch {
                        domain = res.url;
                    }
                }
                historySources.push({
                    url: res.url,
                    domain,
                    favicon: res.favicon_url,
                });
            });
        });
    };

    const toolBlockRegex = /\[TOOL_START\]([\s\S]*?)\[TOOL_END\]/g;
    while ((match = toolBlockRegex.exec(item.ai_response)) !== null) {
        const toolBlock = match[1].trim();
        try {
            const { actions, searchResults, remainingContent } = parseToolContent(toolBlock);
            if (!actions.length && !searchResults.length && !remainingContent) {
                continue;
            }

            const toolData: ToolStepData = {
                actions,
                searchResults,
                summary: remainingContent || undefined,
            };

            const title =
                searchResults[0]?.query
                    ? `Search: ${searchResults[0].query}`
                    : actions[0]?.tool_name
                        ? getToolActionLabel(actions[0].tool_name)
                        : 'Tool Execution';

            historySteps.push({
                id: `tool-${item.id}-${historySteps.length}`,
                type: 'tool',
                title,
                tool: toolData,
            });

            addSourcesFromResults(searchResults);
        } catch (error) {
            console.error('Failed to parse tool block from history', error);
        }
    }

    const legacyToolRegex = /TOOL_CALL_START:web_search([\s\S]*?)TOOL_CALL_END:web_search/g;
    while ((match = legacyToolRegex.exec(item.ai_response)) !== null) {
        try {
            const legacyData = JSON.parse(match[1]);
            if (!legacyData?.results) continue;

            const searchResults: SearchResultsData[] = [legacyData];
            const toolData: ToolStepData = {
                actions: [
                    {
                        tool_name: 'web_search',
                        tool_input: legacyData.query,
                        status: 'completed',
                    },
                ],
                searchResults,
            };

            const title = legacyData.query ? `Search: ${legacyData.query}` : 'Web Search';

            historySteps.push({
                id: `tool-${item.id}-${historySteps.length}`,
                type: 'tool',
                title,
                tool: toolData,
            });

            addSourcesFromResults(searchResults);
        } catch (error) {
            console.error('Failed to parse legacy tool call from history', error);
        }
    }


    return { chatMessages: historyChatMessages, steps: historySteps, sources: historySources };
};

 const fetchChatHistory = useCallback(async (chatId: string) => {
    if (!user?.access_token) return;

    setIsSending(true);
    const stopAnimation = runAnalysisAnimation();
    
    setChatHistory([]);
    setSteps([]);
    setSources([]);

    try {
        const response = await fetch(`http://localhost:8000/api/v1/deep-research-chatbot-conversations/${chatId}?page=1&per_page=50`, {
            headers: { 'Authorization': `Bearer ${user.access_token}` },
        });
        const result = await response.json();

        if (!response.ok || !result.status) {
            throw new Error(result.response_description || "Failed to fetch chat history.");
        }
        
        const allChatMessages: ChatMessage[] = [];
        const allSteps: Step[] = [];
        const allSources: Source[] = [];

        result.data.search_result.reverse().forEach((item: any) => {
            const { chatMessages, steps, sources } = processHistoryItem(item);
            allChatMessages.push(...chatMessages);
            allSteps.push(...steps);
            allSources.push(...sources);
        });
        
                setChatHistory(allChatMessages);
                setSteps(allSteps);

                // Deduplicate sources before setting
                const uniqueSources = allSources.filter((source, index, self) =>
                    index === self.findIndex((s) => s.url === source.url)
                );
                setSources(uniqueSources);
                seenSourceUrlsRef.current = new Set(uniqueSources.map(source => source.url));

        const lastItem = result.data.search_result[result.data.search_result.length - 1];
        if (lastItem) {
          setChatTitle(lastItem.chat_title || 'Deep Research');
        }

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error fetching history",
            description: error.message || "Could not load conversation history."
        });
        setActiveChatId(null);
        setChatHistory([]);
    } finally {
        stopAnimation();
        setIsSending(false);
        setAnalysisProgress('');
    }
}, [user?.access_token, toast, setActiveChatId, runAnalysisAnimation]);
  
  useEffect(() => {
    if (activeChatId) {
        if (shouldSkipNextHistoryFetch.current) {
            shouldSkipNextHistoryFetch.current = false;
            return;
        }
        isNewChatSession.current = false;
        fetchChatHistory(activeChatId);
    } else {
        isNewChatSession.current = true;
        setChatHistory([]);
        setSteps([]);
        setSources([]);
        seenSourceUrlsRef.current.clear();
        setChatTitle('Deep Research');
    }
  }, [activeChatId, fetchChatHistory]);
  
  return (
    <div className="h-full">
        <Card className="h-full border-border/50 shadow-lg shadow-black/20">
            <CardContent className="h-full p-0">
                 <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <LeftPanel steps={steps} sources={sources} />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={60} minSize={40}>
                         <ChatPanel
                            isSending={isSending}
                            handleSendMessage={handleSendMessage}
                            chatHistory={chatHistory}
                            analysisProgress={analysisProgress}
                            chatTitle={chatTitle}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </CardContent>
        </Card>
    </div>
  );
}
