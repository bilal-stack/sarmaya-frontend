

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, File as FileIcon, X, Loader2, GitBranch, Sparkles, FolderOpen, Search, Info, TriangleAlert } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ExecutiveSummaryReport } from '@/components/analysis/executive-summary-report';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { usePitchDeckAdvisor } from './layout';
import { StreamParser, ParsedStreamData } from '@/lib/stream-parser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { CompetitorAnalysisModal } from '@/components/competitor-analysis-modal';
import { ResearchToolCard } from '@/components/research-tool-card';
import { SearchResultsCard } from '@/components/search-results-card';


const analysisTabs = [
  'Basic Analysis',
  'Detailed Analysis',
  'Executive Summary',
  'Competitor Analysis',
];

const toolMapping: { [key: string]: string } = {
    'Basic Analysis': 'basic_analysis',
    'Detailed Analysis': 'detailed_analysis',
    'Executive Summary': 'executive_summary',
    'Competitor Analysis': 'competitor_analysis'
};

const analysisActions: { [key: string]: { title: string; description: string; buttonText: string, icon: React.ReactNode, analysisType: 'basic' | 'detailed' | 'executive' | 'competitor' } } = {
  'Basic Analysis': {
    title: 'Start a New Analysis',
    description: 'Get an AI-powered overview of your deck\'s strengths and weaknesses.',
    buttonText: 'Conduct Basic Analysis',
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    analysisType: 'basic'
  },
  'Detailed Analysis': {
    title: 'Start a Detailed Critique',
    description: 'Receive a comprehensive, slide-by-slide evaluation of your pitch deck.',
    buttonText: 'Generate Slide by Slide Critique',
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    analysisType: 'detailed'
  },
  'Executive Summary': {
    title: 'Create an Executive Summary',
    description: 'Let our AI generate a concise, compelling summary for investors.',
    buttonText: 'Generate Executive Summary',
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    analysisType: 'executive'
  },
  'Competitor Analysis': {
      title: 'Launch Competitor Analysis',
      description: 'Upload your pitch deck and competitor materials to generate an in-depth analysis.',
      buttonText: 'Start Competitor Analysis',
      icon: <Search className="h-10 w-10 text-primary" />,
      analysisType: 'competitor'
  }
};


type ChatMessage = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  fileName?: string;
  reportType?: 'basic' | 'detailed' | 'executive' | 'competitor';
  analysisReport?: any;
  parsedData?: ParsedStreamData;
};

const EmptyStateCard = ({ tab, onActionClick }: { tab: string; onActionClick: () => void }) => {
    const actionDetails = analysisActions[tab];

    if (!actionDetails) {
        return null;
    }
    
    return (
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-lg text-center bg-card/50">
                <CardHeader>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                        {actionDetails.icon}
                    </div>
                    <CardTitle className="font-headline text-2xl">{actionDetails.title}</CardTitle>
                    <CardDescription>{actionDetails.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={onActionClick}>
                        {actionDetails.analysisType !== 'competitor' && <Sparkles className="mr-2 h-4 w-4" />}
                        {actionDetails.buttonText}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

const NoDeckSelectedCard = () => (
    <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center bg-card/50">
            <CardHeader>
                 <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <FolderOpen className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Select a Pitch Deck</CardTitle>
                <CardDescription>
                    Please select a pitch deck from the sidebar to begin the analysis, or upload a new one.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
);

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

const AiMessageContent = ({ content, isStreaming, fullText }: { content?: ParsedStreamData, isStreaming: boolean, fullText: string }) => {
    // During streaming, we directly render the accumulated text for smoothness.
    if (isStreaming) {
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>;
    }
    // After streaming, if we have parsed parts, render them structured.
    if (!content?.parts) return <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>;
    
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
                    default:
                        return null;
                }
            })}
        </div>
    );
};


const ChatInterface = ({ tab }: { tab: string }) => {
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [analysisVersion, setAnalysisVersion] = useState<string>("v1");
  const [hasHistory, setHasHistory] = useState(false);
  const [isCompetitorModalOpen, setIsCompetitorModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { activeDeckId, setActiveDeckId, refreshDecks } = usePitchDeckAdvisor();

  const currentTool = useMemo(() => toolMapping[tab], [tab]);

  const runAnalysisAnimation = useCallback((analysisType: 'basic' | 'detailed' | 'executive' | 'competitor') => {
    const steps = analysisType === 'basic' 
      ? ["Thinking...", "Analyzing pitch deck...", "Evaluating market fit...", "Checking financials...", "Finalizing report..."]
      : analysisType === 'detailed' 
      ? ["Thinking...", "Performing slide-by-slide analysis...", "Critiquing content and design...", "Generating recommendations...", "Compiling detailed report..."]
      : analysisType === 'competitor'
      ? ["Thinking...", "Analyzing competitor data...", "Cross-referencing with your deck...", "Generating insights...", "Compiling report..."]
      : ["Thinking...", "Synthesizing key information...", "Drafting executive summary...", "Refining for investor appeal...", "Finalizing summary..."];

    let currentStep = 0;
    
    const interval = setInterval(() => {
        setAnalysisProgress(steps[currentStep]);
        currentStep = (currentStep + 1) % steps.length;
    }, 1500);

    return () => {
      clearInterval(interval);
      setAnalysisProgress('');
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!activeDeckId || !user?.access_token) {
        setChatHistory([]);
        setHasHistory(false);
        return;
    }

    setIsAnalyzing(true);
    setHasHistory(false);
    const stopAnimation = runAnalysisAnimation(currentTool as 'basic' | 'detailed' | 'executive' | 'competitor');
    
    try {
        const response = await fetch(`http://localhost:8000/api/v1/pd-conversations/${activeDeckId}?tool=${currentTool}&page=1&per_page=10`, {
            headers: { 'Authorization': `Bearer ${user.access_token}` },
        });

        const result = await response.json();
        
        if (!response.ok || !result.status) {
            throw new Error(result.response_description || "Failed to fetch conversations.");
        }

        const parser = new StreamParser();
        const history: ChatMessage[] = result.data.search_result
            .reverse() // Reverse to get chronological order
            .flatMap((item: any) => {
                const reportType = currentTool as 'basic' | 'detailed' | 'executive' | 'competitor';
                let parsedData: ParsedStreamData | undefined;
                let analysisReport;

                if (reportType === 'executive') {
                    try {
                        analysisReport = JSON.parse(item.ai_response);
                    } catch(e) {
                        parsedData = { type: 'content', parts: parser.parseContent(item.ai_response) };
                    }
                } else {
                    parsedData = { type: 'content', parts: parser.parseContent(item.ai_response) } as ParsedStreamData;
                }
                
                // Return user message first, then AI response
                return [
                    { id: `user-${item.id}`, sender: 'user' as const, text: item.user_message },
                    { 
                      id: `ai-${item.id}`,
                      sender: 'ai' as const, 
                      text: item.ai_response,
                      reportType: reportType,
                      parsedData: parsedData,
                      analysisReport: analysisReport
                    }
                ];
        });

        if (history.length > 0) {
            setChatHistory(history);
            setHasHistory(true);
        } else {
            setChatHistory([]);
            setHasHistory(false);
        }

    } catch (error: any) {
        setChatHistory([]);
        setHasHistory(false);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        stopAnimation();
        setIsAnalyzing(false);
    }
  }, [activeDeckId, currentTool, user?.access_token, toast, runAnalysisAnimation]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  const handleStreamedResponse = async (response: Response, aiMessageId: string) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("Could not read response stream.");

    const parser = new StreamParser();
    let fullAiResponse = "";
    
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            if (buffer) {
                 try {
                    const json = JSON.parse(buffer);
                    if (json.type === 'metadata') {
                         if (json.has_new_chat_created && json.pda_id) {
                            setActiveDeckId(json.pda_id);
                            refreshDecks();
                        }
                    } else if (json.type === 'content' && json.chunk) {
                        fullAiResponse += json.chunk;
                    }
                } catch (e) {
                    // Not a complete JSON, might be a fragment of text
                    fullAiResponse += buffer;
                }
            }
            break;
        };

        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.lastIndexOf('\n');
        if (boundary === -1) continue;

        const completeChunks = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);

        const chunks = completeChunks.split('\n').filter(c => c.trim());

        for (const chunk of chunks) {
            let parsedChunk = chunk;
            if (parsedChunk.startsWith('data: ')) {
                parsedChunk = parsedChunk.substring(6);
            }
            if (parsedChunk === '[DONE]') continue;
            
            try {
                const json = JSON.parse(parsedChunk);
                 if (json.type === 'metadata') {
                     if (json.has_new_chat_created && json.pda_id) {
                        setActiveDeckId(json.pda_id);
                        refreshDecks();
                    }
                } else if (json.type === 'content' && json.chunk) {
                    fullAiResponse += json.chunk;
                     setChatHistory(prev =>
                        prev.map(chat =>
                            chat.id === aiMessageId
                                ? { ...chat, text: fullAiResponse }
                                : chat
                        )
                    );
                }
            } catch (e) {
                fullAiResponse += parsedChunk;
            }
        }
         setChatHistory(prev =>
            prev.map(chat =>
                chat.id === aiMessageId
                    ? { ...chat, text: fullAiResponse }
                    : chat
            )
        );
    }

      const finalParsedData = { type: 'content', parts: parser.parseContent(fullAiResponse) } as ParsedStreamData;
      let finalAnalysisReport: any = undefined;

      const reportType = toolMapping[tab] as 'basic' | 'detailed' | 'executive';
      if (reportType === 'executive') {
        try {
          finalAnalysisReport = JSON.parse(fullAiResponse);
        } catch(e) {
          // It's not a JSON report, so it's markdown
        }
      }

       setChatHistory(prev =>
          prev.map(chat =>
              chat.id === aiMessageId
                  ? { ...chat, text: fullAiResponse, parsedData: finalParsedData, analysisReport: finalAnalysisReport }
                  : chat
          )
      );
  };
  
  const handleSendMessage = useCallback(async (isActionTriggered = false) => {
    if (tab === 'Competitor Analysis') {
        setIsCompetitorModalOpen(true);
        return;
    }

    if (!activeDeckId) {
        toast({ variant: 'destructive', title: "No Pitch Deck Selected", description: "Please select a pitch deck from the list." });
        return;
    }
    
    const userMessageText = isActionTriggered ? (analysisActions[tab]?.buttonText || `Perform ${tab}`) : message;

    if (!userMessageText.trim() && !attachedFile) return;
    
    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now()}`;

    const userMessage: ChatMessage = { id: userMessageId, sender: 'user', text: userMessageText };
    if (attachedFile) userMessage.fileName = attachedFile.name;
    
    const reportType = toolMapping[tab] as 'basic' | 'detailed' | 'executive';
    const aiPlaceholderMessage: ChatMessage = { 
        id: aiMessageId, 
        sender: 'ai', 
        text: '',
        reportType: reportType,
    };
    
    setChatHistory(prev => {
        if (!isActionTriggered && prev.length > 0) {
            return [...prev, userMessage, aiPlaceholderMessage];
        }
        // If it's an action, we might clear previous history of the same type.
        // For now, let's just append.
        return [userMessage, aiPlaceholderMessage];
    });
    setHasHistory(true);
    
    const currentFile = attachedFile;

    setMessage('');
    setAttachedFile(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    if (!user?.access_token) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        return;
    }

    let analysisEndpoint = '';

    if (tab === 'Basic Analysis') {
        analysisEndpoint = 'http://localhost:8000/api/v1/pitch-decks/basic-analysis';
    } else if (tab === 'Detailed Analysis') {
        analysisEndpoint = 'http://localhost:8000/api/v1/pitch-decks/detailed-analysis';
    } else if (tab === 'Executive Summary') {
        analysisEndpoint = 'http://localhost:8000/api/v1/pitch-decks/executive-summary';
    } else {
        return;
    }

    setIsAnalyzing(true);
    const stopAnimation = runAnalysisAnimation(reportType);

    const formData = new FormData();
    if(currentFile) formData.append('file', currentFile);
    formData.append('message', userMessageText);
    formData.append('version', analysisVersion);
    formData.append('pitch_deck_id', activeDeckId);

    try {
        const response = await fetch(analysisEndpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.access_token}` },
            body: formData,
        });

        if (!response.ok || !response.body) {
             const errorResult = await response.json().catch(() => ({ response_description: 'Analysis failed.' }));
            throw new Error(errorResult.response_description);
        }
        
        await handleStreamedResponse(response, aiMessageId);

    } catch (error: any) {
        const errorResponse: ChatMessage = { 
            id: aiMessageId, 
            sender: 'ai', 
            text: '',
            parsedData: { type: 'content', parts: [{ type: 'text', content: error.message || "I've encountered an error during the analysis. Please try again." }] }
        };
        setChatHistory(prev => prev.map(c => c.id === aiMessageId ? errorResponse : c));
    } finally {
        stopAnimation();
        setIsAnalyzing(false);
        fetchConversations();
    }
  }, [activeDeckId, tab, message, attachedFile, analysisVersion, user?.access_token, toast, runAnalysisAnimation, handleStreamedResponse, fetchConversations, setActiveDeckId, refreshDecks]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAnalyzing]);

  if (!activeDeckId && !isAnalyzing) {
      return <NoDeckSelectedCard />;
  }

  if (chatHistory.length === 0 && !isAnalyzing && !hasHistory) {
      return (
          <>
            <EmptyStateCard tab={tab} onActionClick={() => handleSendMessage(true)} />
            {tab === 'Competitor Analysis' && (
                <CompetitorAnalysisModal 
                    isOpen={isCompetitorModalOpen}
                    onClose={() => setIsCompetitorModalOpen(false)}
                    onAnalysisStart={(files) => {
                        console.log('Start analysis with:', files);
                        setIsCompetitorModalOpen(false);
                        // TODO: Implement the analysis logic
                    }}
                />
            )}
          </>
      );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {chatHistory.map((chat, index) => {
            const isLastMessage = index === chatHistory.length - 1;
            const isStreaming = isAnalyzing && chat.sender === 'ai' && isLastMessage;

            return (
             <div key={chat.id} className={`flex w-full items-start gap-4 ${chat.sender === 'user' ? 'justify-end' : ''}`}>
                {chat.sender === 'ai' && (
                    <Avatar>
                        <AvatarImage src="https://picsum.photos/seed/ai-avatar/40/40" />
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                )}
                 <div className={`prose prose-sm prose-invert max-w-none relative group rounded-lg p-3 ${chat.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                     {chat.sender === 'ai' && !chat.text && isAnalyzing && isLastMessage ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <p className="text-sm">{analysisProgress || 'Analyzing...'}</p>
                        </div>
                    ) : chat.reportType === 'executive' && chat.analysisReport ? (
                        <ExecutiveSummaryReport report={chat.analysisReport} />
                    ) : (
                         <AiMessageContent content={chat.parsedData} isStreaming={isStreaming} fullText={chat.text} />
                    )}

                    {chat.fileName && (
                         <div className="mt-2 flex items-center gap-2 rounded-md border border-white/20 bg-black/20 p-2 text-sm">
                            <FileIcon className="h-4 w-4" />
                            <span>{chat.fileName}</span>
                        </div>
                    )}
                </div>
                 {chat.sender === 'user' && (
                    <Avatar>
                        <AvatarImage src="https://picsum.photos/seed/user-avatar/40/40" />
                        <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                )}
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
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
            placeholder="Send a message..."
            className="pr-48"
            rows={1}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            disabled={isAnalyzing || !activeDeckId}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
             <Select value={analysisVersion} onValueChange={setAnalysisVersion} disabled={isAnalyzing || !activeDeckId}>
                <SelectTrigger className="w-auto gap-2 border-0 bg-transparent shadow-none ring-offset-0 focus:ring-0">
                  <SelectValue asChild>
                     <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        <Badge variant="secondary" className="px-1.5 py-0.5">{analysisVersion}</Badge>
                      </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">Version 1</SelectItem>
                  <SelectItem value="v2">Version 2</SelectItem>
                  <SelectItem value="v3">Version 3</SelectItem>
                </SelectContent>
              </Select>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.ppt,.pptx"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || !activeDeckId}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              size="icon"
              onClick={() => handleSendMessage()}
              disabled={isAnalyzing || !activeDeckId || (!message.trim() && !attachedFile)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PitchDeckAdvisorPage() {
  const [activeTab, setActiveTab] = useState(analysisTabs[0]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
  };

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full flex-col">
        <TabsList className="grid w-full grid-cols-4">
          {analysisTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        {analysisTabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-grow overflow-hidden">
            <Card className="h-full border-border/50 shadow-lg shadow-black/20">
              <CardContent className="h-full p-0">
                <ChatInterface tab={tab} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
