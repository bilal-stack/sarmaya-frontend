'use client';

import { useState, useRef, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, User, Play, Pause, StopCircle, Notebook, Paperclip, File as FileIcon, X, Info, TriangleAlert } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useInvestorPitchCoach } from './context';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { StreamParser, ParsedStreamData, type ParsedContentPart } from '@/lib/stream-parser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReportPanel } from '@/components/investor-pitch-coach-report-panel';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { ResearchToolCard } from '@/components/research-tool-card';
import { SearchResultsCard } from '@/components/search-results-card';


type ChatMessage = {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  fileName?: string;
  parsedData?: ParsedStreamData;
};

const WelcomeCard = () => (
    <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center bg-card/50">
            <CardHeader>
                 <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <User className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Welcome to the Investor Pitch Coach</CardTitle>
                <CardDescription>
                    Practice your pitch and get instant feedback. Start a new chat to begin.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
);

type ChatPanelProps = {
  isSending: boolean;
  setIsSending: (isSending: boolean) => void;
    setGalsiNotes: Dispatch<SetStateAction<ParsedContentPart[]>>;
  setGalsiReport: (update: (prev: string) => string) => void;
};

const ChatPanel = ({ isSending, setIsSending, setGalsiNotes, setGalsiReport }: ChatPanelProps) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [isPitching, setIsPitching] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeChat, setActiveChat, newChatData, clearNewChatData, refreshChatList } = useInvestorPitchCoach();
  const newChatIdRef = useRef<string | null>(null);
  const initialMessageSentRef = useRef(false);
  const wordBuffer = useRef<{ [key: string]: string }>({ chat: '', notes: '', report: '' });

  const runAnalysisAnimation = useCallback(() => {
    const steps = ["Analyzing...", "Thinking...", "Generating feedback..."];
    let currentStep = 0;
    const interval = setInterval(() => {
        setAnalysisProgress(steps[currentStep]);
        currentStep = (currentStep + 1) % steps.length;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

    const normalizeNotes = useCallback((raw: string) => {
        if (!raw) return '';
        return raw.replace(/\[NOTES\]/g, '').replace(/\[\/NOTES\]/g, '').trim();
    }, []);

  const handleStreamedResponse = async (response: Response, aiMessageId: string) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("Could not read response stream.");

    const parser = new StreamParser();
    const notesParser = new StreamParser();
    let fullAiResponse = '';
    
     while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        parser.parse(chunk, (parsedData) => {
             if (parsedData.type === 'metadata' && parsedData.has_new_chat_created && parsedData.chatroom_id) {
                newChatIdRef.current = parsedData.chatroom_id;
            } else if ((parsedData.type === 'content' || parsedData.type === 'questions' || parsedData.type === 'math') && parsedData.chunk) {
                fullAiResponse += parsedData.chunk;
                if (parsedData.type === 'questions') {
                    fullAiResponse += '\n';
                }

                const intermediateParsedContent = parser.parseContent(fullAiResponse);
                const interimCleanedText = parser.cleanStreamingText(fullAiResponse);

                 setChatHistory(prev =>
                    prev.map(chat =>
                        chat.id === aiMessageId
                            ? {
                                ...chat,
                                text: interimCleanedText,
                                parsedData: { type: 'content', parts: intermediateParsedContent }
                              }
                            : chat
                    )
                );
            } else if (parsedData.type === 'notes' && parsedData.chunk) {
                wordBuffer.current.notes += parsedData.chunk;
                const noteParts = notesParser.parseContent(wordBuffer.current.notes);
                setGalsiNotes(noteParts);
            } else if (parsedData.type === 'report' && parsedData.chunk) {
                setGalsiReport(prev => prev + parsedData.chunk!);
            }
        });
    }

     const finalParsedContent = parser.parseContent(fullAiResponse);
     const finalCleanedText = parser.getFinalContent(fullAiResponse);
     setChatHistory(prev =>
        prev.map(chat =>
            chat.id === aiMessageId
                ? { ...chat, text: finalCleanedText, parsedData: { type: 'content', parts: finalParsedContent } }
                : chat
        )
    );

    if (wordBuffer.current.notes) {
        const normalizedFinalNotes = normalizeNotes(wordBuffer.current.notes);
        wordBuffer.current.notes = normalizedFinalNotes;
        const finalNoteParts = normalizedFinalNotes ? notesParser.parseContent(normalizedFinalNotes) : [];
        setGalsiNotes(finalNoteParts);
    }
  };


  const handleSendMessage = async (initialMessage?: string) => {
    const messageToSend = initialMessage ?? message;
    const currentFile = newChatData?.file || attachedFile;

    if (!messageToSend.trim() && !currentFile) return;

    const userMessage: ChatMessage = { sender: 'user', text: messageToSend, id: `user-${Date.now()}` };
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessagePlaceholder: ChatMessage = { 
        id: aiMessageId, 
        sender: 'ai', 
        text: '',
        parsedData: { type: 'content', parts: [] } 
    };
    
    if (currentFile) {
      userMessage.fileName = currentFile.name;
    }
    
    setChatHistory(prev => [...prev, userMessage, aiMessagePlaceholder]);
    setGalsiNotes([]); // Clear previous notes on new message
    setGalsiReport(() => ''); // Clear previous report on new message
    wordBuffer.current = { chat: '', notes: '', report: '' };
    
    setMessage('');
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

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
    if (currentFile) formData.append('file', currentFile);
    if (activeChat) formData.append('ipcc_chat_id', activeChat.id);
    
    if (newChatData) {
        formData.append('investor_name', newChatData.investorName);
        if(newChatData.investorWebsite) formData.append('investor_website', newChatData.investorWebsite);
        const otherLinks = newChatData.otherLinks.map(link => link.value).join(',');
        if (otherLinks) formData.append('other_links', otherLinks);
    }

    try {
        const response = await fetch('http://localhost:8000/api/v1/investor-pitch-coach/chat', {
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
            text: '',
            parsedData: {
                type: 'content',
                parts: [{ type: 'text', content: error.message || "I encountered an error. Please try again." }]
            }
        };
        setChatHistory(prev => prev.map(c => c.id === aiMessageId ? errorResponse : c));
        toast({ variant: "destructive", title: "API Error", description: error.message });
    } finally {
        stopAnimation();
        setAnalysisProgress('');
        setIsSending(false);
        if (newChatIdRef.current) {
            refreshChatList(); // This will fetch the new list, and setActiveChat will be handled there.
            newChatIdRef.current = null;
        }
        if (newChatData) {
            clearNewChatData();
        }
    }
  };
  
  useEffect(() => {
    if (newChatData && !initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      handleSendMessage("Let's start the pitch practice.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatData]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const handleEndSession = () => {
    setIsPitching(false);
    toast({ title: 'Pitch session ended.' });
  }
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

    const fetchChatHistory = useCallback(async (chatId: string) => {
        if (!user?.access_token) return;

        setIsSending(true);
        const stopAnimation = runAnalysisAnimation();

        try {
            const response = await fetch(`http://localhost:8000/api/v1/investor-pitch-coach-conversations/${chatId}?page=1&per_page=50`, {
                headers: { 'Authorization': `Bearer ${user.access_token}` },
            });
            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.response_description || "Failed to fetch chat history.");
            }
            
            const history: ChatMessage[] = result.data.search_result
                .reverse()
                .flatMap((item: any) => {
                    const parserInstance = new StreamParser();
                    const parsedData = parserInstance.parseContent(item.ai_response);
                    const cleanedResponse = parserInstance.getFinalContent(item.ai_response);

                    return [
                        { id: `user-${item.id}`, sender: 'user' as const, text: item.user_message, fileName: item.metadata?.file_name },
                        { id: `ai-${item.id}`, sender: 'ai' as const, text: cleanedResponse, parsedData: { type: 'content', parts: parsedData } }
                    ];
                });
            
            setChatHistory(history);

            // Use the most recent notes available in history if provided by the API
            let latestNotes = '';
            for (let i = result.data.search_result.length - 1; i >= 0; i--) {
                const item = result.data.search_result[i];
                if (item.notes) {
                    latestNotes = item.notes;
                    break;
                }
            }

            if (latestNotes) {
                const normalizedLatestNotes = normalizeNotes(latestNotes);
                wordBuffer.current.notes = normalizedLatestNotes;
                setGalsiNotes(normalizedLatestNotes ? new StreamParser().parseContent(normalizedLatestNotes) : []);
            } else if (!activeChat?.notes) {
                wordBuffer.current.notes = '';
                setGalsiNotes([]);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error fetching history",
                description: error.message || "Could not load conversation history."
            });
            setActiveChat(null);
            setChatHistory([]);
        } finally {
            stopAnimation();
            setIsSending(false);
            setAnalysisProgress('');
        }
    }, [user?.access_token, toast, setActiveChat, runAnalysisAnimation, setGalsiNotes, activeChat, normalizeNotes]);

    useEffect(() => {
        if (activeChat) {
            fetchChatHistory(activeChat.id);
            const normalizedNotes = normalizeNotes(activeChat.notes || '');
            wordBuffer.current.notes = normalizedNotes;
            const parsedNotes = normalizedNotes ? new StreamParser().parseContent(normalizedNotes) : [];
            setGalsiNotes(parsedNotes);
            setGalsiReport(() => ''); // Clear report when changing chat
        } else if (!newChatData) {
            setChatHistory([]);
            setGalsiNotes([]);
            wordBuffer.current = { chat: '', notes: '', report: '' };
            setGalsiReport(() => '');
            setMessage('');
            setAttachedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            initialMessageSentRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat, newChatData, normalizeNotes]);

  return (
    <div className="flex h-full flex-col">
        {chatHistory.length === 0 && !isSending && !activeChat && !newChatData ? (
            <WelcomeCard />
        ) : (
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                {chatHistory.map((chat, index) => {
                    const isLastMessage = index === chatHistory.length - 1;
                    const isStreaming = isSending && chat.sender === 'ai' && isLastMessage;

                    return (
                    <div key={chat.id || index} className={`flex w-full items-start gap-4 ${chat.sender === 'user' ? 'justify-end' : ''}`}>
                        {chat.sender === 'ai' && (
                            <Avatar>
                                <AvatarImage src="https://picsum.photos/seed/ai-pitchcoach/40/40" />
                                <AvatarFallback>PC</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={`prose prose-sm prose-invert max-w-none relative group rounded-lg p-3 ${chat.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                           {isStreaming && !chat.text ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <p className="text-sm">{analysisProgress || 'Thinking...'}</p>
                                </div>
                            ) : chat.parsedData ? (
                                <AiMessageContent content={chat.parsedData} />
                            ) : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.text}</ReactMarkdown>
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
                    );
                })}
                
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
                    placeholder="Practice your pitch..."
                    className="pr-[11rem]"
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    disabled={isSending || (!activeChat && !newChatData)}
                />
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending || (!!newChatData)}
                        title="Attach file"
                    >
                        <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleEndSession}
                        disabled={isSending || !isPitching}
                        title="End Session"
                    >
                        <StopCircle className="h-5 w-5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPitching(prev => !prev)}
                        disabled={isSending}
                        title={isPitching ? 'Pause' : 'Play'}
                    >
                        {isPitching ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <Button
                        type="submit"
                        size="icon"
                        onClick={() => handleSendMessage()}
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

const Callout = ({ type, children }: { type: string, children: React.ReactNode }) => {
    const Icon = type === 'info' ? Info : TriangleAlert;
    const colorClass = type === 'info' ? 'bg-blue-900/30 border-blue-500' : 'bg-yellow-900/30 border-yellow-500';

    return (
        <div className={`not-prose my-4 rounded-md border-l-4 p-4 ${colorClass}`}>
            <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${type === 'info' ? 'text-blue-400' : 'text-yellow-400'}`} />
                <div className="text-sm">{children}</div>
            </div>
        </div>
    )
}

const TableRenderer = ({ content }: { content: string }) => {
    return (
        <div className="prose prose-sm prose-invert max-w-none my-4" dangerouslySetInnerHTML={{ __html: new StreamParser().renderTableToHtml(content) }} />
    );
};

const renderContentPart = (part: ParsedContentPart, index: number) => {
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
            return <Callout key={index} type={part.calloutType || 'info'}>{part.content}</Callout>;
        case 'diagram':
            return <MermaidDiagram key={index} chart={part.content} />;
        case 'tool':
            return <ResearchToolCard key={index} content={part.content} />;
        case 'search_results':
            return (
                <div key={index} className="my-4">
                    <SearchResultsCard data={part.content} />
                </div>
            );
        case 'math':
            return (
                <div key={index} className="not-prose my-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <p className="font-mono text-lg leading-relaxed text-primary">{part.content}</p>
                </div>
            );
        case 'questions':
            return (
                <div key={index} className="not-prose my-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-primary">Key Questions</h4>
                    <div className="prose prose-sm prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

const AiMessageContent = ({ content }: { content: ParsedStreamData }) => {
    if (!content.parts) return <ReactMarkdown remarkPlugins={[remarkGfm]}></ReactMarkdown>;
    
    return (
        <div className="prose prose-sm prose-invert max-w-none">
            {content.parts.map((part, index) => renderContentPart(part, index))}
        </div>
    );
};


type NotesPanelProps = {
    galsiNotes: ParsedContentPart[];
}

const NotesPanel = ({ galsiNotes }: NotesPanelProps) => {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Notebook /> Notes Panel (Live Investor Insights)</h3>
            </div>
            <ScrollArea className="flex-1">
                 <div className="prose prose-sm prose-invert max-w-none p-4">
                    {galsiNotes.length > 0 ? (
                        galsiNotes.map((part, index) => renderContentPart(part, index))
                    ) : (
                        <p className="text-muted-foreground">Live insights from the AI will appear here...</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

export default function InvestorPitchCoachPage() {
  const { activeChat, newChatData } = useInvestorPitchCoach();

    const [galsiNotes, setGalsiNotes] = useState<ParsedContentPart[]>([]);
  const [galsiReport, setGalsiReport] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const chatPanelKey = useMemo(() => {
    if (newChatData) return `new-chat-${Date.now()}`;
    return activeChat?.id || 'welcome-screen';
  }, [newChatData, activeChat]);

  const mainPanels = (
    <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={60}>
            <ChatPanel 
                key={chatPanelKey}
                isSending={isSending}
                setIsSending={setIsSending}
                setGalsiNotes={setGalsiNotes}
                setGalsiReport={setGalsiReport}
            />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={40} minSize={20} collapsible>
            <NotesPanel galsiNotes={galsiNotes} />
        </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <div className="h-full">
        <Card className="h-full flex flex-col border-border/50 shadow-lg shadow-black/20">
            <CardContent className="h-full p-0 flex-1">
                {galsiReport ? (
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={50} minSize={30}>
                            {mainPanels}
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50} minSize={30}>
                            <ReportPanel reportContent={galsiReport} />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : mainPanels}
            </CardContent>
        </Card>
    </div>
  );
}
