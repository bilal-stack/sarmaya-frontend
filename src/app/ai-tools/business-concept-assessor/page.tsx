'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, User, Play, Pause, StopCircle, Paperclip, File as FileIcon, X, Info, TriangleAlert, FileText, HelpCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useBusinessConceptAssessor } from './context';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { StreamParser, ParsedStreamData } from '@/lib/stream-parser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
                    <FileText className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Welcome to the Business Concept Assessor</CardTitle>
                <CardDescription>
                    Get feedback on your business idea. Start a new chat to begin.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
);

type ChatPanelProps = {
  isSending: boolean;
  setIsSending: (isSending: boolean) => void;
  setQuestionsToAsk: (update: (prev: string) => string) => void;
};

const ChatPanel = ({ isSending, setIsSending, setQuestionsToAsk }: ChatPanelProps) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeChat, setActiveChat, newChatData, clearNewChatData, refreshChatList } = useBusinessConceptAssessor();
  const newChatIdRef = useRef<string | null>(null);
  const initialMessageSentRef = useRef(false);

  const runAnalysisAnimation = useCallback(() => {
    const steps = ["Analyzing concept...", "Assessing market fit...", "Evaluating potential..."];
    let currentStep = 0;
    const interval = setInterval(() => {
        setAnalysisProgress(steps[currentStep]);
        currentStep = (currentStep + 1) % steps.length;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

    const normalizeQuestions = useCallback((raw: string) => {
        if (!raw) return '';
        return raw.replace(/\[QUESTIONS_TO_ASK_START\]/g, '').replace(/\[QUESTIONS_TO_ASK_END\]/g, '').trim();
    }, []);

  const handleStreamedResponse = async (response: Response, aiMessageId: string) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("Could not read response stream.");

    const parser = new StreamParser();
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
                    setQuestionsToAsk(prev => {
                        const prefix = prev && !prev.endsWith('\n') ? `${prev}\n` : prev;
                        return `${prefix || ''}${parsedData.chunk}`;
                    });
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
  };


  const handleSendMessage = async (initialMessage?: string) => {
    const messageToSend = initialMessage ?? message;
    const currentFile = newChatData?.file || attachedFile;

    if (!messageToSend.trim() && !currentFile && !newChatData) return;

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
    setQuestionsToAsk(() => ''); // Clear previous questions on new message
    
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
    if (newChatData) { // This is a new chat
        formData.append('concept_name', newChatData.conceptName);
        if(newChatData.conceptDetails) formData.append('description', newChatData.conceptDetails);
        if(newChatData.file) formData.append('file', newChatData.file);
        if(messageToSend) formData.append('message', messageToSend);
    } else { // This is an existing chat
        formData.append('message', messageToSend);
        if (currentFile) formData.append('file', currentFile);
        if (activeChat) formData.append('bca_chat_id', activeChat.id);
    }
    
    try {
        const response = await fetch('http://localhost:8000/api/v1/business-concept-assessor/chat', {
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
            refreshChatList();
            // Do not setActiveChat here. Let the list refresh handle it.
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
      // For a new chat, the first message is special.
      // We don't need a user-typed message, the context is in newChatData.
      handleSendMessage("Let's assess my business concept.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatData]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

    const fetchChatHistory = useCallback(async (chatId: string) => {
        if (!user?.access_token) return;

        setIsSending(true);
        const stopAnimation = runAnalysisAnimation();

        try {
            const response = await fetch(`http://localhost:8000/api/v1/business-concept-assessor-conversations/${chatId}?page=1&per_page=50`, {
                headers: { 'Authorization': `Bearer ${user.access_token}` },
            });
            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.response_description || "Failed to fetch chat history.");
            }
            
            const history: ChatMessage[] = result.data.search_result
                .reverse()
                .flatMap((item: any) => {
                    const parser = new StreamParser();
                    const parsedParts = parser.parseContent(item.ai_response);
                    const hasQuestionsPart = parsedParts.some(part => part.type === 'questions');
                    const normalizedQuestions = normalizeQuestions(item.questions_to_ask || '');
                    const cleanedAiResponse = parser.getFinalContent(item.ai_response);

                    const mergedParts = hasQuestionsPart || !normalizedQuestions
                        ? parsedParts
                        : [...parsedParts, { type: 'questions' as const, content: normalizedQuestions }];

                    return [
                        { id: `user-${item.id}`, sender: 'user' as const, text: item.user_message, fileName: item.metadata?.file_name },
                        { id: `ai-${item.id}`, sender: 'ai' as const, text: cleanedAiResponse, parsedData: { type: 'content', parts: mergedParts } }
                    ];
                });
            
            setChatHistory(history);
            // Assuming questions are part of the latest AI message if persisted
            const lastAiMessage = result.data.search_result[0]; // first item is latest
            if (lastAiMessage) {
                setQuestionsToAsk(() => normalizeQuestions(lastAiMessage.questions_to_ask || ''));
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
    }, [user?.access_token, toast, setActiveChat, runAnalysisAnimation, setQuestionsToAsk, normalizeQuestions]);

    useEffect(() => {
        if (activeChat) {
            fetchChatHistory(activeChat.id);
            setQuestionsToAsk(() => normalizeQuestions(activeChat.questions || ''));
        } else if (!newChatData) {
            setChatHistory([]);
            setQuestionsToAsk(() => '');
            setMessage('');
            setAttachedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            initialMessageSentRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat, newChatData, normalizeQuestions]);

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
                                <AvatarImage src="https://picsum.photos/seed/ai-bca/40/40" />
                                <AvatarFallback>BCA</AvatarFallback>
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
                    placeholder="Describe your business concept..."
                    className="pr-28"
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
                        type="submit"
                        size="icon"
                        onClick={() => handleSendMessage()}
                        disabled={isSending || (!message.trim() && !attachedFile && !newChatData)}
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

const AiMessageContent = ({ content }: { content: ParsedStreamData }) => {
    if (!content.parts) return <ReactMarkdown remarkPlugins={[remarkGfm]}></ReactMarkdown>;
    
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
                                <p className="font-mono text-lg leading-relaxed text-primary">
                                    {part.content}
                                </p>
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
            })}
        </div>
    );
};


type QuestionsPanelProps = {
    questionsToAsk: string;
}

const QuestionsPanel = ({ questionsToAsk }: QuestionsPanelProps) => {
    const components = {
        blockquote({ node, ...props }: any) {
            const textContent = node.children[0]?.children.map((child: any) => child.value).join('') || '';
            const match = textContent.match(/^\[(info|warning)\]\s*/);

            if (match) {
                const type = match[1];
                const content = textContent.substring(match[0].length);
                return <Callout type={type}>{content}</Callout>;
            }
            return <blockquote {...props} />;
        },
        code(props: any) {
            const {children, className, node, ...rest} = props
            const match = /language-(\w+)/.exec(className || '')
            if (match && match[1] === 'mermaid') {
              return <MermaidDiagram chart={String(children)} />
            }
            return <code {...rest} className={className}>{children}</code>
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <h3 className="text-lg font-semibold flex items-center gap-2"><HelpCircle /> Questions To Ask</h3>
            </div>
            <ScrollArea className="flex-1">
                 <div className="prose prose-sm prose-invert max-w-none p-4">
                    {questionsToAsk ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{questionsToAsk}</ReactMarkdown>
                    ) : (
                        <p className="text-muted-foreground">Key questions to consider will appear here...</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

export default function BusinessConceptAssessorPage() {
  const { activeChat, newChatData } = useBusinessConceptAssessor();

  const [questionsToAsk, setQuestionsToAsk] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const chatPanelKey = useMemo(() => {
    if (newChatData) return `new-chat-${Date.now()}`;
    return activeChat?.id || 'welcome-screen';
  }, [newChatData, activeChat]);

  return (
    <div className="h-full">
        <Card className="h-full flex flex-col border-border/50 shadow-lg shadow-black/20">
            <CardContent className="h-full p-0 flex-1">
                 <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={60}>
                        <ChatPanel 
                            key={chatPanelKey}
                            isSending={isSending}
                            setIsSending={setIsSending}
                            setQuestionsToAsk={setQuestionsToAsk}
                        />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={40} minSize={20} collapsible>
                        <QuestionsPanel questionsToAsk={questionsToAsk} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </CardContent>
        </Card>
    </div>
  );
}

    