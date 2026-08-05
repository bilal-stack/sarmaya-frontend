

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, Loader2, File as FileIcon, X, Bot, Info, TriangleAlert, Download, FileText, FileType } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useLifeScienceChatbot, LIFE_SCIENCE_DEFAULT_CHAT_TITLE } from './context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamParser, type ParsedStreamData, type ParsedContentPart } from '@/lib/stream-parser';
import { ResearchToolCard } from '@/components/research-tool-card';
import { SearchResultsCard } from '@/components/search-results-card';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import mermaid from 'mermaid';

type ChatMessage = {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  fileName?: string;
  isHtml?: boolean;
  parsedData?: ParsedStreamData;
};

const DEFAULT_CHAT_TITLE = LIFE_SCIENCE_DEFAULT_CHAT_TITLE;

const WelcomeCard = () => (
    <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center bg-card/50">
            <CardHeader>
                 <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Bot className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Welcome to the Life Science Chatbot</CardTitle>
                <CardDescription>
                    Ask a question or upload a document to get started.
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
    );
};

const TableRenderer = ({ content, partIndex, onExport }: { content: string, partIndex: number, onExport: () => void }) => {
    return (
        <div className="relative group/table my-4">
             <Button
                variant="outline"
                size="icon"
                className="absolute -top-4 right-0 h-7 w-7 bg-background"
                onClick={onExport}
            >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export table to PDF</span>
            </Button>
            <div className="prose prose-sm prose-invert max-w-none overflow-x-auto" dangerouslySetInnerHTML={{ __html: new StreamParser().renderTableToHtml(content) }} />
        </div>
    );
};


const AiMessageContent = ({ content, fullText, isStreaming, onExportTable }: { content?: ParsedStreamData, fullText: string, isStreaming: boolean, onExportTable: (tableContent: string) => void }) => {
    // During streaming and after, always prefer the parsed content if it exists
    if (content?.parts) {
        return (
            <div className="prose prose-base prose-invert max-w-none">
                {content.parts.map((part, index) => {
                    switch (part.type) {
                        case 'text':
                            return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
                        case 'table':
                            return <TableRenderer key={index} content={part.content} partIndex={index} onExport={() => onExportTable(part.content)} />;
                        case 'code':
                            if (part.language === 'html') {
                                return <div key={index} dangerouslySetInnerHTML={{ __html: part.content }} />;
                            }
                            return (
                                <pre key={index} className="bg-gray-800 p-2 rounded-md text-white text-sm overflow-x-auto">
                                    <code>{part.content}</code>
                                </pre>
                            );
                        case 'callout':
                            return <Callout key={index} type={part.calloutType || 'info'}>{part.content}</Callout>;
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
                        case 'tool':
                            return <ResearchToolCard key={index} content={part.content} />;
                        case 'questions':
                            return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
                        case 'search_results':
                            return (
                                <div key={index} className="my-4">
                                    <SearchResultsCard data={part.content} />
                                </div>
                            );
                        case 'divider':
                            return <hr key={index} className="my-4 border-border" />;
                        default:
                            return null;
                    }
                })}
            </div>
        );
    }
    
    // Fallback for initial render or if parsing fails
    const cleanedText = new StreamParser().cleanStreamingText(fullText);
    return <ReactMarkdown className="prose prose-base prose-invert max-w-none" remarkPlugins={[remarkGfm]}>{cleanedText}</ReactMarkdown>;
};


export default function LifeScienceChatbotPage() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
    const { activeChatId, setActiveChatId, refreshChatList, activeChatTitle, setActiveChatTitle } = useLifeScienceChatbot();
    const resolvedChatTitle = activeChatTitle || DEFAULT_CHAT_TITLE;
  const newChatIdRef = useRef<string | null>(null);

  const handleExportTableToPdf = (tableContent: string) => {
    const doc = new jsPDF();
    const parser = new StreamParser();
    const tableHtml = parser.renderTableToHtml(tableContent);
    const tableElement = document.createElement('div');
    tableElement.innerHTML = tableHtml;

    const table = tableElement.querySelector('table');
    if(table) {
        (doc as any).autoTable({
            html: table,
        });
        doc.save('table.pdf');
        toast({ title: 'Export Successful', description: 'The table has been exported to PDF.' });
    } else {
         toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not find the table to export.' });
    }
};

    const handleExport = async (format: 'PDF' | 'Word', messageId: string, aiContent: ParsedStreamData) => {
    toast({ title: `Exporting to ${format}...`, description: 'Please wait while the document is being generated.' });

    if (format === 'PDF') {
        await handleExportToPdf(messageId, resolvedChatTitle, aiContent);
    } else if (format === 'Word') {
        await handleExportToWord(aiContent);
    }
  };

  const handleExportToWord = async (aiContent: ParsedStreamData) => {
      try {
          const content = aiContent.parts?.flatMap(part => {
              switch (part.type) {
                  case 'text':
                      return part.content.split('\n').map((line: string) => {
                          if (!line.trim()) return new Paragraph({ text: '' });
                          
                          if (line.startsWith('### ')) {
                              return new Paragraph({ text: line.substring(4), heading: HeadingLevel.HEADING_3 });
                          } else if (line.startsWith('## ')) {
                              return new Paragraph({ text: line.substring(3), heading: HeadingLevel.HEADING_2 });
                          } else if (line.startsWith('# ')) {
                              return new Paragraph({ text: line.substring(2), heading: HeadingLevel.HEADING_1 });
                          } else if (line.startsWith('- ') || line.startsWith('* ')) {
                              return new Paragraph({ text: line.substring(2), bullet: { level: 0 } });
                          }
                          
                          const textRuns = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((textPart: string) => {
                              if (textPart.startsWith('**') && textPart.endsWith('**')) {
                                  return new TextRun({ text: textPart.slice(2, -2), bold: true });
                              } else if (textPart.startsWith('*') && textPart.endsWith('*')) {
                                  return new TextRun({ text: textPart.slice(1, -1), italics: true });
                              }
                              return new TextRun(textPart);
                          });
                          return new Paragraph({ children: textRuns });
                      });
                  case 'table':
                      const rowsData = part.content.trim().split('\n');
                      const header = rowsData[0].split('|').map((h: string) => h.trim()).filter(Boolean);
                      const body = rowsData.slice(2).map(
                          (row: string) => row.split('|').map((c: string) => c.trim()).filter(Boolean)
                      );
                      
                      if (header.length === 0) return [];
                      
                      return new Table({
                          width: { size: 100, type: WidthType.PERCENTAGE },
                          rows: [
                              new TableRow({
                                  children: header.map((h: string) => new TableCell({
                                      children: [new Paragraph({ text: h, alignment: AlignmentType.CENTER })],
                                      shading: { fill: "f2f2f2" },
                                  })),
                              }),
                              ...body.map((row: string[]) => new TableRow({
                                  children: row.slice(0, header.length).map((cell: string) => new TableCell({ children: [new Paragraph(cell)] })),
                              })),
                          ]
                      });
                  case 'divider':
                      return new Paragraph({ border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } } });
                  default:
                      return [];
              }
          }) || [];

          const doc = new Document({
              creator: "Galsi AI",
              title: "Life Science Chat Export",
              description: "An export from the Galsi Life Science Chatbot.",
              styles: {
                  default: {
                      document: {
                          run: {
                              font: "Calibri",
                              size: "11pt",
                          },
                      },
                  },
              },
              sections: [{ children: content.flat() }],
          });

          const blob = await Packer.toBlob(doc);
          saveAs(blob, 'lifescience-chat-export.docx');
          toast({ title: 'Export Successful', description: 'Your chat has been exported to Word.' });

      } catch (e) {
          console.error("Word export failed", e);
          toast({ variant: 'destructive', title: 'Word Export Failed', description: 'An error occurred while generating the DOCX file.' });
      }
  };


    const handleExportToPdf = async (_messageId: string, chatTitleParam: string, aiContent: ParsedStreamData) => {
    if (!aiContent?.parts?.length) {
        toast({ variant: 'destructive', title: 'Export Failed', description: 'No AI response is available to export yet.' });
        return;
    }

    const colors: Record<string, [number, number, number]> = {
        text: [17, 24, 39],
        subText: [100, 116, 139],
        accent: [14, 165, 233],
        accentDark: [2, 132, 199],
        surface: [248, 250, 252],
        border: [226, 232, 240],
        codeBg: [15, 23, 42],
        codeText: [226, 232, 240],
        calloutInfo: [219, 234, 254],
        calloutWarn: [254, 243, 199],
    } as const;

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 56;
    const marginY = 80;
    const contentWidth = pageWidth - marginX * 2;
    const bodyFontSize = 11.5;
    const bodyLineHeight = 17;
    const paragraphSpacing = 8;
    let cursorY = marginY;
    const pageTimestamp = new Date();
    let watermarkDataUrl: string | null = null;
    type InlineSegment = { text: string; style: 'normal' | 'bold' | 'italic' | 'code' };

    const mermaidStrokeColor = '#8F9CB7';
    const mermaidFillColor = '#EBEDF0';
    const mermaidTextColor = '#0F172A';

    const mermaidThemeVariables = {
        primaryColor: mermaidFillColor,
        secondaryColor: mermaidFillColor,
        tertiaryColor: '#FFFFFF',
        primaryBorderColor: mermaidStrokeColor,
        primaryTextColor: mermaidTextColor,
        lineColor: mermaidStrokeColor,
        edgeLabelBackground: '#FFFFFF',
    } as const;

    const applyMermaidBranding = (svg: string) => {
        if (!svg) return svg;
        const styleBlock = `\n<style>\n  :root { --mermaid-font-family: 'Arial, sans-serif'; }\n  .node rect, .node path, .node circle, .node ellipse, .node polygon { fill: ${mermaidFillColor} !important; stroke: ${mermaidStrokeColor} !important; }\n  .label text { fill: ${mermaidTextColor} !important; }\n  .edgePath .path { stroke: ${mermaidStrokeColor} !important; }\n  .arrowheadPath { fill: ${mermaidStrokeColor} !important; stroke: ${mermaidStrokeColor} !important; }\n  .cluster rect { stroke: ${mermaidStrokeColor} !important; }\n</style>\n`;
        const svgTagEnd = svg.indexOf('>');
        if (svgTagEnd === -1) return svg;
        return `${svg.slice(0, svgTagEnd + 1)}${styleBlock}${svg.slice(svgTagEnd + 1)}`;
    };

    const normalizeText = (value: string) => {
        if (!value) return '';
        return value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/[\u2018\u2019\u2032\u02BC]/g, "'")
            .replace(/[\u201C\u201D\u2033]/g, '"')
            .replace(/[\u2013\u2014\u2212]/g, '-')
            .replace(/\u2026/g, '...')
            .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
    };

    const splitToWidth = (value: string, width: number) => doc.splitTextToSize(normalizeText(value), width);

    const parseInlineSegments = (text: string): InlineSegment[] => {
        const segments: InlineSegment[] = [];
        const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ text: text.slice(lastIndex, match.index), style: 'normal' });
            }

            const token = match[0];
            if (token.startsWith('**')) {
                segments.push({ text: token.slice(2, -2), style: 'bold' });
            } else if (token.startsWith('*')) {
                segments.push({ text: token.slice(1, -1), style: 'italic' });
            } else if (token.startsWith('`')) {
                segments.push({ text: token.slice(1, -1), style: 'code' });
            }
            lastIndex = match.index + token.length;
        }

        if (lastIndex < text.length) {
            segments.push({ text: text.slice(lastIndex), style: 'normal' });
        }

        return segments.filter(segment => segment.text.length > 0);
    };

    const ensureSpace = (heightNeeded: number) => {
        if (cursorY + heightNeeded > pageHeight - marginY - 50) {
            drawPageFooter();
            doc.addPage();
            cursorY = marginY;
        }
    };

    const renderInlineSegments = (segments: InlineSegment[], indent = 0, options?: { initialY?: number; trailingSpacing?: number }) => {
        if (!segments.length) {
            cursorY += options?.trailingSpacing ?? paragraphSpacing;
            return;
        }

        const availableWidth = Math.max(contentWidth - indent, 40);
        const maxX = marginX + indent + availableWidth;
        let x = marginX + indent;

        if (options?.initialY !== undefined) {
            cursorY = options.initialY;
        } else {
            ensureSpace(bodyLineHeight);
        }

        let y = cursorY;

        const advanceLine = () => {
            y += bodyLineHeight;
            if (y > pageHeight - marginY - 50) {
                drawPageFooter();
                doc.addPage();
                y = marginY;
            }
            cursorY = y;
            x = marginX + indent;
        };

        segments.forEach(segment => {
            const normalized = normalizeText(segment.text);
            if (!normalized) return;

            const pieces = normalized.match(/\S+|\s+/g) || [];
            pieces.forEach(piece => {
                const isWhitespace = /^\s+$/.test(piece);
                const fontFamily = segment.style === 'code' ? 'courier' : 'helvetica';
                const fontStyle = segment.style === 'bold' ? 'bold' : segment.style === 'italic' ? 'italic' : 'normal';
                const fontSize = segment.style === 'code' ? bodyFontSize - 0.5 : bodyFontSize;
                doc.setFont(fontFamily, fontStyle);
                doc.setFontSize(fontSize);

                if (isWhitespace) {
                    const spaceWidth = doc.getTextWidth(' ');
                    x += spaceWidth * Math.max(1, piece.length);
                    return;
                }

                const tokenWidth = doc.getTextWidth(piece);

                // If word is too long for current line, move to next line
                if (x + tokenWidth > maxX) {
                    // If word itself is longer than line width, break it intelligently
                    if (tokenWidth > availableWidth - 20) {
                        let remainingText = piece;
                        while (remainingText.length > 0) {
                            let chunkSize = remainingText.length;
                            let chunk = remainingText;
                            let chunkWidth = doc.getTextWidth(chunk);
                            
                            // Find the largest chunk that fits
                            while (chunkWidth > maxX - x && chunkSize > 1) {
                                chunkSize--;
                                chunk = remainingText.substring(0, chunkSize);
                                chunkWidth = doc.getTextWidth(chunk);
                            }
                            
                            if (chunkSize === 1 && x > marginX + indent) {
                                // Even single char doesn't fit, move to next line
                                advanceLine();
                                continue;
                            }
                            
                            if (segment.style === 'code') {
                                const padX = 3;
                                const padY = 3;
                                setFillColor([236, 239, 244]);
                                doc.roundedRect(x - padX, y - fontSize + padY, chunkWidth + padX * 2, fontSize + padY * 2, 4, 4, 'F');
                                setFillColor(colors.surface);
                            }
                            
                            doc.text(chunk, x, y);
                            x += chunkWidth;
                            remainingText = remainingText.substring(chunkSize);
                            
                            if (remainingText.length > 0) {
                                advanceLine();
                            }
                        }
                        return;
                    }
                    advanceLine();
                }

                if (segment.style === 'code') {
                    const padX = 3;
                    const padY = 3;
                    setFillColor([236, 239, 244]);
                    doc.roundedRect(x - padX, y - fontSize + padY, tokenWidth + padX * 2, fontSize + padY * 2, 4, 4, 'F');
                    setFillColor(colors.surface);
                }

                doc.text(piece, x, y);
                x += tokenWidth;
            });
        });

        cursorY = y + bodyLineHeight + (options?.trailingSpacing ?? paragraphSpacing);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        setTextColor(colors.text);
    };

    const measureInlineHeight = (segments: InlineSegment[], indent = 0) => {
        if (!segments.length) return paragraphSpacing;

        const availableWidth = Math.max(contentWidth - indent, 40);
        const maxX = marginX + indent + availableWidth;
        let x = marginX + indent;
        let lines = 1;

        segments.forEach(segment => {
            const normalized = normalizeText(segment.text);
            if (!normalized) return;

            const pieces = normalized.match(/\S+|\s+/g) || [];
            pieces.forEach(piece => {
                const isWhitespace = /^\s+$/.test(piece);
                const fontFamily = segment.style === 'code' ? 'courier' : 'helvetica';
                const fontStyle = segment.style === 'bold' ? 'bold' : segment.style === 'italic' ? 'italic' : 'normal';
                const fontSize = segment.style === 'code' ? bodyFontSize - 0.5 : bodyFontSize;
                doc.setFont(fontFamily, fontStyle);
                doc.setFontSize(fontSize);
                if (isWhitespace) {
                    const spaceWidth = doc.getTextWidth(' ');
                    x += spaceWidth * Math.max(1, piece.length);
                    return;
                }

                const tokenWidth = doc.getTextWidth(piece);

                if (x + tokenWidth > maxX) {
                    lines += 1;
                    x = marginX + indent + tokenWidth;
                } else {
                    x += tokenWidth;
                }
            });
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        return lines * bodyLineHeight + paragraphSpacing;
    };

    const setTextColor = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);
    const setFillColor = (color: [number, number, number]) => doc.setFillColor(color[0], color[1], color[2]);
    const setStrokeColor = (color: [number, number, number]) => doc.setDrawColor(color[0], color[1], color[2]);

    const loadWatermarkImage = async () => {
        const sources = [
            'https://spotlytmediav1.blob.core.windows.net/images/galsi_logo.png',
            '/logo.png'
        ];

        for (const url of sources) {
            try {
                console.log('Attempting to load cover logo from:', url);
                const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
                if (!response.ok) {
                    console.warn('Failed to fetch cover logo:', response.status);
                    continue;
                }
                const blob = await response.blob();
                console.log('Cover logo blob loaded, size:', blob.size, 'type:', blob.type);
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                console.log('Cover logo data URL created, length:', dataUrl.length);
                return dataUrl;
            } catch (error) {
                console.error('Cover logo image load failed for source', url, error);
            }
        }

        console.error('All cover logo sources failed');
        return null;
    };

    const addCoverPage = () => {
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;

        // Cover background color #091734
        doc.setFillColor(9, 23, 52);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        if (watermarkDataUrl) {
            try {
                const imageProps = doc.getImageProperties(watermarkDataUrl);
                const aspectRatio = imageProps.width ? imageProps.height / imageProps.width : 0.5;
                const logoWidth = Math.min(pageWidth * 0.6, 320);
                const logoHeight = logoWidth * aspectRatio;
                const logoX = centerX - logoWidth / 2;
                const logoY = centerY - logoHeight - 20;

                doc.addImage(
                    watermarkDataUrl,
                    'PNG',
                    logoX,
                    logoY,
                    logoWidth,
                    logoHeight,
                    undefined,
                    'FAST'
                );
            } catch (error) {
                console.error('Cover logo rendering failed:', error);
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        setTextColor([255, 255, 255]);
        doc.text('Life Science Intelligence Report', centerX, centerY + 40, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        setTextColor([198, 210, 234]);
        doc.text(`Generated ${new Date().toLocaleDateString()}`, centerX, centerY + 65, { align: 'center' });

        doc.addPage();
        cursorY = marginY;
        setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
    };

    const drawPageFooter = () => {
        const { pageNumber } = doc.getCurrentPageInfo();
        const footerY = pageHeight - 30;
        setStrokeColor(colors.text);
        doc.setLineWidth(1.2);
        doc.line(marginX, footerY, pageWidth - marginX, footerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        setTextColor(colors.subText);
        doc.text(`Page ${pageNumber}`, marginX, footerY + 12);
        setTextColor(colors.text);
    };

    const addChatTitleHeading = (title?: string) => {
        const normalizedTitle = normalizeText((title || DEFAULT_CHAT_TITLE).trim()) || DEFAULT_CHAT_TITLE;
        ensureSpace(80);
        cursorY += 10;
        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        setTextColor([9, 23, 52]);
        const lines = splitToWidth(normalizedTitle, contentWidth);
        lines.forEach((line: string, idx: number) => {
            if (idx > 0) {
                cursorY += bodyLineHeight + 2;
                ensureSpace(bodyLineHeight + 2);
            }
            doc.text(line, marginX, cursorY);
        });

        cursorY += 18;
        setStrokeColor(colors.text);
        doc.setLineWidth(1.2);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 26;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        setTextColor(colors.text);
    };

    const addSectionTitle = (title: string) => {
        ensureSpace(36);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        setTextColor(colors.subText);
        const label = normalizeText(title).toUpperCase();
        doc.text(label, marginX, cursorY);
        setStrokeColor(colors.accentDark);
        doc.setLineWidth(2);
        doc.line(marginX, cursorY + 6, marginX + 64, cursorY + 6);
        cursorY += 30;
        setTextColor(colors.text);
    };

    const addHeading = (level: 1 | 2 | 3, text: string) => {
        const sizes = { 1: 18, 2: 15, 3: 13 } as const;
        const spacing = { 1: 26, 2: 22, 3: 20 } as const;
        
        // Strip markdown formatting from heading text
        const cleanText = text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1');
        
        // Reserve extra space to keep heading with content (avoid orphaned headings)
        const minContentSpace = level === 1 ? 80 : level === 2 ? 60 : 40;
        ensureSpace(spacing[level as keyof typeof spacing] + minContentSpace);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sizes[level as keyof typeof sizes]);
        setTextColor(colors.accentDark);
        
        const lines = splitToWidth(cleanText, contentWidth);
        lines.forEach((line: string, idx: number) => {
            if (idx > 0) {
                cursorY += bodyLineHeight;
                ensureSpace(bodyLineHeight);
            }
            doc.text(line, marginX, cursorY);
        });
        
        cursorY += spacing[level as keyof typeof spacing];
        setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
    };

    const addParagraph = (rawText: string) => {
        if (!rawText.trim()) {
            cursorY += paragraphSpacing;
            return;
        }
        const segments = parseInlineSegments(rawText);
        renderInlineSegments(segments, 0);
    };

    const addListItem = (text: string) => {
        const clean = text.replace(/^[\-*]\s+/, '').trim();
        if (!clean) {
            cursorY += paragraphSpacing;
            return;
        }
        const segments = parseInlineSegments(clean);
        const blockHeight = Math.max(measureInlineHeight(segments, 14), bodyLineHeight);
        ensureSpace(blockHeight);
        const bulletY = cursorY;
        setFillColor(colors.accent);
        doc.circle(marginX + 2, bulletY - 4, 1.5, 'F');
        setFillColor(colors.surface);
        renderInlineSegments(segments, 14, { initialY: bulletY });
    };

    const addDivider = () => {
        const blockHeight = 24;
        ensureSpace(blockHeight);
        setStrokeColor(colors.border);
        doc.setLineWidth(0.8);
        const centerX = pageWidth / 2;
        doc.line(marginX, cursorY, centerX - 12, cursorY);
        doc.line(centerX + 12, cursorY, pageWidth - marginX, cursorY);
        setFillColor(colors.accent);
        doc.circle(centerX, cursorY, 2.5, 'F');
        cursorY += 24;
    };

    const addCodeBlock = (code: string) => {
        const lines = splitToWidth(code.trim(), contentWidth - 24);
        const height = lines.length * 16 + 28;
        ensureSpace(height + 8);
        setFillColor(colors.codeBg);
        doc.roundedRect(marginX, cursorY, contentWidth, height, 8, 8, 'F');
        doc.setFont('courier', 'normal');
        doc.setFontSize(10.5);
        setTextColor(colors.codeText);
        doc.text(lines, marginX + 12, cursorY + 20);
        cursorY += height + 16;
        setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
    };

    const addCallout = (text: string, type: string = 'info') => {
        const bg = type === 'warning' ? colors.calloutWarn : colors.calloutInfo;
        const label = type === 'warning' ? 'Important' : 'Insight';
        const paddingX = 18;
        const paddingTop = 26;
        const paddingBottom = 18;
        const segments = parseInlineSegments(text.trim());
        const textHeight = measureInlineHeight(segments, paddingX);
        const blockHeight = paddingTop + textHeight + paddingBottom;

        ensureSpace(blockHeight + 6);
        setFillColor(bg);
        doc.roundedRect(marginX, cursorY, contentWidth, blockHeight, 12, 12, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        setTextColor(type === 'warning' ? [161, 98, 7] : colors.accentDark);
        doc.text(label, marginX + paddingX, cursorY + 14);
        setTextColor(colors.text);

        cursorY += paddingTop;
        renderInlineSegments(segments, paddingX, { trailingSpacing: paddingBottom });
    };

    const addMathBlock = (content: string) => {
        const lines = splitToWidth(content.trim(), contentWidth - 24);
        const height = lines.length * 16 + 32;
        ensureSpace(height + 10);
        setFillColor(colors.surface);
        doc.roundedRect(marginX, cursorY, contentWidth, height, 10, 10, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(12);
        doc.text(lines, marginX + 12, cursorY + 24);
        cursorY += height + 20;
        doc.setFont('helvetica', 'normal');
    };

    const addTable = (markdown: string) => {
        const allRows = markdown.trim().split('\n').filter(Boolean);
        if (allRows.length < 2) return;
        
        // Parse header row
        const headers = allRows[0].split('|').map(cell => normalizeText(cell.trim())).filter(Boolean);
        if (headers.length === 0) return;
        
        // Skip separator row (row 1) and parse body rows starting from row 2
        const body = allRows.slice(2).map(row => {
            const cells = row.split('|').map(cell => normalizeText(cell.trim())).filter(Boolean);
            // Ensure each row has same number of columns as header
            while (cells.length < headers.length) {
                cells.push('');
            }
            return cells.slice(0, headers.length);
        }).filter(row => row.some(cell => cell.length > 0));
        
        if (body.length === 0) return;
        
        ensureSpace(60);
        (doc as any).autoTable({
            startY: cursorY,
            head: [headers],
            body,
            margin: { left: marginX, right: marginX },
            tableWidth: contentWidth,
            styles: { 
                font: 'helvetica', 
                fontSize: 8.5, 
                lineColor: colors.border, 
                textColor: colors.text,
                cellPadding: 2.5,
                overflow: 'linebreak',
                cellWidth: 'auto',
                halign: 'left',
                minCellWidth: 20
            },
            headStyles: { 
                fillColor: colors.accentDark, 
                textColor: [255, 255, 255], 
                fontStyle: 'bold',
                halign: 'left',
                cellPadding: 3.5,
                fontSize: 9
            },
            bodyStyles: {
                valign: 'top',
                minCellHeight: 10
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            theme: 'grid',
            columnStyles: {},
            didParseCell: function(data: any) {
                // Force text wrapping for all cells
                if (data.cell.section === 'body' || data.cell.section === 'head') {
                    data.cell.styles.cellWidth = 'auto';
                }
            },
            didDrawPage: function(data: any) {
                cursorY = data.cursor.y;
            }
        });
        cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 20;
    };

    const formatJson = (value: unknown) => {
        if (typeof value === 'string') return normalizeText(value);
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const addToolBlock = (content: unknown) => {
        const lines = splitToWidth(formatJson(content), contentWidth - 24);
        const height = lines.length * 14 + 30;
        ensureSpace(height + 12);
        setFillColor(colors.surface);
        doc.roundedRect(marginX, cursorY, contentWidth, height, 10, 10, 'F');
        doc.setFont('courier', 'normal');
        doc.setFontSize(10.5);
        doc.text(lines, marginX + 12, cursorY + 22);
        cursorY += height + 20;
        doc.setFont('helvetica', 'normal');
    };

    const addSearchResults = (content: any) => {
        if (!content) return;
        const results = Array.isArray(content.results) ? content.results : [];
        if (results.length === 0) {
            addParagraph(formatJson(content));
            return;
        }
        results.forEach((result: any, index: number) => {
            const title = result.title || `Result ${index + 1}`;
            addHeading(3, title);
            if (result.snippet) {
                addParagraph(result.snippet);
            }
            if (result.url) {
                setTextColor(colors.accentDark);
                renderInlineSegments([{ text: result.url, style: 'italic' }], 0, { trailingSpacing: 16 });
                setTextColor(colors.text);
            }
        });
    };

    const getSvgDimensions = (svgMarkup: string) => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgMarkup, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        const defaultSize = { width: 1200, height: 600 };
        if (!svgElement) return defaultSize;
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
            const [, , width, height] = viewBox.split(' ').map(Number);
            if (!Number.isNaN(width) && !Number.isNaN(height)) {
                return { width, height };
            }
        }
        const width = parseFloat(svgElement.getAttribute('width') || '0');
        const height = parseFloat(svgElement.getAttribute('height') || '0');
        if (width > 0 && height > 0) {
            return { width, height };
        }
        return defaultSize;
    };

    const sanitizeMermaidChart = (chart: string) => {
        let cleanChart = chart.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').trim();

        if (!cleanChart) return '';

        if (cleanChart.startsWith('quadrantChart')) {
            cleanChart = cleanChart.replace(/"([^\"]+)"\s*:\s*(\d+\.?\d*)\s*:\s*(\d+\.?\d*)/g, '$1: [$2, $3]');
            cleanChart = cleanChart.replace(/^(\s+)([A-Za-z][^\s:]+)\s*:\s*(\d+\.?\d*)\s*:\s*(\d+\.?\d*)/gm, '$1$2: [$3, $4]');
        }

        return cleanChart
            .split('\n')
            .map(line => line.replace(/\t/g, '    ').trimEnd())
            .filter(line => {
                const trimmed = line.trim().toLowerCase();
                if (!trimmed) return true;
                if (trimmed.startsWith('error in text')) return false;
                if (trimmed.startsWith('syntax error in text')) return false;
                if (trimmed.includes('mermaid version')) return false;
                if (trimmed.includes('syntax error in')) return false;
                return true;
            })
            .join('\n');
    };

    const renderMermaidDiagram = async (chart: string) => {
        try {
            const sanitizedChart = sanitizeMermaidChart(chart);
            if (!sanitizedChart) {
                console.warn('Mermaid chart empty after sanitization');
                addParagraph('Diagram preview unavailable (empty content).');
                return;
            }

            console.log('Rendering mermaid chart:', sanitizedChart.substring(0, 100) + '...');
            
            // Initialize mermaid
            mermaid.initialize({ 
                startOnLoad: false, 
                securityLevel: 'loose', 
                theme: 'neutral', 
                fontFamily: 'Arial, sans-serif',
                themeVariables: mermaidThemeVariables,
            });

            // Parse and render to SVG
            const uniqueId = `mermaid-pdf-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const renderResult = await mermaid.render(uniqueId, sanitizedChart);
            console.log('Mermaid render complete, SVG length:', renderResult.svg?.length || 0);
            const brandedSvg = applyMermaidBranding(renderResult.svg || '');
            
            if (!brandedSvg) {
                console.error('No SVG returned from mermaid.render');
                addParagraph('Diagram rendering failed (no SVG output).');
                return;
            }

            // Get SVG dimensions
            const { width: svgWidth, height: svgHeight } = getSvgDimensions(brandedSvg);
            console.log('SVG dimensions:', svgWidth, 'x', svgHeight);

            // Create a properly configured canvas with CORS-safe image loading
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (!ctx) {
                console.error('Could not get canvas context');
                addParagraph('Diagram rendering failed (canvas error).');
                return;
            }

            // Convert SVG string to a data URI directly (avoids CORS)
            const svgBlob = new Blob([brandedSvg], { type: 'image/svg+xml;charset=utf-8' });
            const reader = new FileReader();
            
            const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(svgBlob);
            });

            // Load the data URI into an image
            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                
                img.onload = () => {
                    console.log('Image loaded successfully');
                    try {
                        // Fill white background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        // Draw image scaled
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                
                img.onerror = (err) => {
                    console.error('Image loading failed:', err);
                    reject(new Error('Failed to load SVG as image'));
                };
                
                // Use data URI directly to avoid CORS
                img.src = dataUrl;
            });

            // Convert canvas to PNG data URL
            const pngDataUrl = canvas.toDataURL('image/png', 1.0);
            console.log('Canvas converted to PNG, length:', pngDataUrl.length);

            // Calculate scaling for PDF
            const padding = 18;
            const maxDrawableWidth = contentWidth - padding * 2;
            const aspectRatio = svgHeight / svgWidth;
            let scaledWidth = Math.min(maxDrawableWidth, svgWidth);
            let scaledHeight = scaledWidth * aspectRatio;
            
            const maxDrawableHeight = pageHeight - marginY * 2 - 100;
            if (scaledHeight > maxDrawableHeight) {
                scaledHeight = maxDrawableHeight;
                scaledWidth = scaledHeight / aspectRatio;
            }

            const blockHeight = scaledHeight + padding * 2;
            ensureSpace(blockHeight + 16);
            
            // Draw background
            setFillColor(colors.surface);
            doc.roundedRect(marginX, cursorY, contentWidth, blockHeight, 12, 12, 'F');
            
            // Center and add image
            const imageX = marginX + (contentWidth - scaledWidth) / 2;
            doc.addImage(pngDataUrl, 'PNG', imageX, cursorY + padding, scaledWidth, scaledHeight, undefined, 'FAST');
            
            console.log('Diagram added to PDF at', imageX, cursorY + padding, 'size:', scaledWidth, 'x', scaledHeight);
            cursorY += blockHeight + 24;
            
        } catch (error: any) {
            console.error('Mermaid rendering error:', error);
            console.error('Error stack:', error?.stack);
            addParagraph(`⚠ Diagram could not be rendered. Error: ${error?.message || 'Unknown error'}`);
            addCodeBlock(chart.substring(0, 500));
        }
    };

    watermarkDataUrl = await loadWatermarkImage();
    
    if (watermarkDataUrl) {
        console.log('Cover logo loaded successfully');
    } else {
        console.warn('Cover logo failed to load, cover will use text only');
        toast({ title: 'Note', description: 'Cover logo image could not be loaded' });
    }

    addCoverPage();
    addChatTitleHeading(chatTitleParam);

    for (const part of aiContent.parts) {
        switch (part.type) {
            case 'text':
            case 'questions': {
                const lines = part.content.split('\n');
                lines.forEach((line: string) => {
                    if (!line.trim() || line.trim() === '---') {
                        ensureSpace(12);
                        cursorY += 12;
                        return;
                    }
                    if (line.startsWith('### ')) {
                        addHeading(3, line.replace('### ', '').trim());
                    } else if (line.startsWith('## ')) {
                        addHeading(2, line.replace('## ', '').trim());
                    } else if (line.startsWith('# ')) {
                        addHeading(1, line.replace('# ', '').trim());
                    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                        addListItem(line.trim());
                    } else if (/^\d+\.\s+/.test(line.trim())) {
                        addListItem(line.trim().replace(/^\d+\.\s+/, ''));
                    } else {
                        addParagraph(line);
                    }
                });
                break;
            }
            case 'table':
                addTable(part.content);
                break;
            case 'code':
                addCodeBlock(part.content);
                break;
            case 'callout':
                addCallout(part.content, part.calloutType);
                break;
            case 'divider':
                // Skip dividers entirely
                break;
            case 'diagram':
                await renderMermaidDiagram(part.content);
                break;
            case 'math':
                addMathBlock(part.content);
                break;
            case 'tool':
                addToolBlock(part.content);
                break;
            case 'search_results':
                addSearchResults(part.content);
                break;
            default:
                if (part.content) {
                    addParagraph(String(part.content));
                }
        }
    }

    drawPageFooter();

    try {
        doc.save('lifescience-chat-export.pdf');
        toast({ title: 'Export Successful', description: 'Your chat has been exported to PDF.' });
    } catch (error) {
        console.error('PDF export failed', error);
        toast({ variant: 'destructive', title: 'Export Failed', description: 'An error occurred while generating the PDF.' });
    }
};

  const runAnalysisAnimation = useCallback(() => {
    const steps = ["Analyzing...", "Thinking for a better answer...", "Generating response...", "Cross-referencing data...", "Finalizing answer..."];
    let currentStep = 0;
    
    const interval = setInterval(() => {
        setAnalysisProgress(steps[currentStep]);
        currentStep = (currentStep + 1) % steps.length;
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const handleStreamedResponse = async (response: Response, aiMessageId: string) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Could not read response stream.");
    const decoder = new TextDecoder();
    
    const parser = new StreamParser();
    let fullAiResponse = '';
    
    const processData = (data: ParsedStreamData) => {
        if (data.type === 'metadata') {
            if (data.has_new_chat_created && data.chatroom_id) {
                newChatIdRef.current = data.chatroom_id;
            }
            if (data.chat_title) {
                setActiveChatTitle(data.chat_title);
            }
        } else if ((data.type === 'content' || data.type === 'questions' || data.type === 'math') && data.chunk) {
            fullAiResponse += data.chunk;
            if (data.type === 'questions') fullAiResponse += '\n';
            const intermediateParsedContent = parser.parseContent(fullAiResponse);
            setChatHistory(prev =>
                prev.map(chat =>
                    chat.id === aiMessageId 
                        ? { 
                            ...chat, 
                            text: fullAiResponse,
                            parsedData: { type: 'content', parts: intermediateParsedContent }
                          } 
                        : chat
                )
            );
        }
    };
    
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
             if (buffer) {
                try {
                    const json = JSON.parse(buffer);
                    processData(json);
                } catch(e) {
                    processData({ type: 'content', chunk: buffer });
                }
             }
             break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process line by line
        let boundary = buffer.lastIndexOf('\n');
        if (boundary === -1) continue;

        const completeLines = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);
        
        const lines = completeLines.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
            let cleanLine = line;
            if (cleanLine.startsWith('data: ')) {
                cleanLine = cleanLine.substring(6);
            }
            if (cleanLine === "[DONE]") continue;

             try {
                const json = JSON.parse(cleanLine);
                processData(json);
            } catch(e) {
                processData({ type: 'content', chunk: cleanLine });
            }
        }
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !attachedFile) return;

    const userMessage: ChatMessage = { sender: 'user', text: message, fileName: attachedFile?.name, id: `user-${Date.now()}` };
    
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessagePlaceholder: ChatMessage = { 
      id: aiMessageId, 
      sender: 'ai', 
      text: '', 
      parsedData: { type: 'content', parts: [] } 
    };

    setChatHistory(prev => [...prev, userMessage, aiMessagePlaceholder]);
    
    const currentFile = attachedFile;
    const currentMessage = message;
    
    setMessage('');
    setAttachedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    setIsSending(true);

    if (!user?.access_token) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        setIsSending(false);
        return;
    }

    const formData = new FormData();
    formData.append('message', currentMessage);
    if (currentFile) {
        formData.append('file', currentFile);
    }
    if (activeChatId) {
        formData.append('lsc_chat_id', activeChatId);
    }
    
    const stopAnimation = runAnalysisAnimation();

    try {
        const endpoint = 'http://localhost:8000/api/v1/life-science-chatbot/chat';
        const response = await fetch(endpoint, {
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
        setChatHistory(prev => prev.map(chat => chat.id === aiMessageId ? errorResponse : chat));
        toast({
            variant: "destructive",
            title: "API Error",
            description: error.message || "Failed to get a response from the chatbot."
        });
    } finally {
        stopAnimation();
        setIsSending(false);
        setAnalysisProgress('');
        if (newChatIdRef.current) {
            setActiveChatId(newChatIdRef.current);
            refreshChatList();
            newChatIdRef.current = null;
        } else if (activeChatId) {
            // No new chat, but maybe refresh anyway?
        } else {
             // It was a new chat, but something failed before we got an ID
        }
    }
  };
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };
  
  const fetchChatHistory = useCallback(async (chatId: string) => {
    if (!user?.access_token) return;

    setIsSending(true);
    const stopAnimation = runAnalysisAnimation();
    
    try {
        const response = await fetch(`http://localhost:8000/api/v1/life-science-chatbot-conversations/${chatId}?page=1&per_page=50`, {
             headers: { 'Authorization': `Bearer ${user.access_token}` },
        });
        const result = await response.json();
        
        if (!response.ok || !result.status) {
            throw new Error(result.response_description || "Failed to fetch chat history.");
        }
        
        const history: ChatMessage[] = result.data.search_result
            .reverse()
            .flatMap((item: any, index: number) => {
                 const parser = new StreamParser();
                 const parsedData = parser.parseContent(item.ai_response);
                
                return [
                    { id: `user-${item.id || index}`, sender: 'user' as const, text: item.user_message, fileName: item.attachment || undefined },
                    { id: `ai-${item.id || index}`, sender: 'ai' as const, text: item.ai_response, parsedData: { type: 'content', parts: parsedData } }
                ]
            });
        
        setChatHistory(history);

        const lastItem = result.data.search_result[result.data.search_result.length - 1];
        const derivedTitle = result.data.chat_title || lastItem?.chat_title;
        setActiveChatTitle(derivedTitle || DEFAULT_CHAT_TITLE);

    } catch(error: any) {
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
      fetchChatHistory(activeChatId);
    } else {
    setChatHistory([]);
    setMessage('');
    setAttachedFile(null);
    setActiveChatTitle(DEFAULT_CHAT_TITLE);
    }
  }, [activeChatId, fetchChatHistory]);

  return (
    <div className="h-full">
        <Card className="h-full border-border/50 shadow-lg shadow-black/20">
            <CardContent className="h-full p-0">
                 <div className="flex h-full flex-col">
                    {chatHistory.length === 0 && !isSending && !activeChatId ? (
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
                                            <AvatarImage src="https://picsum.photos/seed/ai-lifesci/40/40" />
                                            <AvatarFallback>AI</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={`relative group max-w-[85%] rounded-lg p-3 ${chat.sender === 'user' ? 'bg-primary text-primary-foreground text-base' : 'bg-muted text-base'}`}>
                                        {chat.sender === 'ai' && chat.parsedData && chat.parsedData.parts && chat.parsedData.parts.length > 0 && !isStreaming && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        <span className="sr-only">Export</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleExport('PDF', chat.id!, chat.parsedData!)}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Export as PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleExport('Word', chat.id!, chat.parsedData!)}>
                                                        <FileType className="mr-2 h-4 w-4" />
                                                        Export as Word
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                        {isStreaming && !chat.text ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <p className="text-sm">{analysisProgress || 'Thinking...'}</p>
                                            </div>
                                        ) : (
                                            <AiMessageContent 
                                                content={chat.parsedData} 
                                                fullText={chat.text}
                                                isStreaming={isStreaming}
                                                onExportTable={handleExportTableToPdf} 
                                            />
                                        )}
                                        {chat.fileName && (
                                            <div className="mt-2 flex items-center gap-2 rounded-md border border-white/20 bg-black/20 p-2 text-sm text-white">
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
                            placeholder="Ask a life science question..."
                            className="pr-24"
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
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                                type="submit"
                                size="icon"
                                onClick={handleSendMessage}
                                disabled={isSending || (!message.trim() && !attachedFile)}
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
