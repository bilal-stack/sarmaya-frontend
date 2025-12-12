
'use client';
import { Bot, Info, TriangleAlert } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


const Callout = ({ type, children }: { type: string, children: React.ReactNode }) => {
    const Icon = type === 'info' ? Info : TriangleAlert;
    const colorClass = type === 'info' ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-yellow-100 border-yellow-500 text-yellow-800';

    return (
        <div style={{
            margin: '16px 0',
            padding: '16px',
            borderLeft: '4px solid',
            borderColor: type === 'info' ? '#3B82F6' : '#FBBF24',
            backgroundColor: type === 'info' ? '#DBEAFE' : '#FEF3C7'
        }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <Icon style={{ height: '20px', width: '20px', color: type === 'info' ? '#2563EB' : '#D97706' }} />
                <div style={{ fontSize: '14px', color: '#1F2937' }}>{children}</div>
            </div>
        </div>
    );
};

const TableRenderer = ({ content }: { content: string }) => {
    // Basic markdown to HTML table conversion for PDF
    const rows = content.trim().split('\n');
    const headers = rows[0].split('|').map(h => h.trim()).filter(h => h);
    const body = rows.slice(2).map(row => row.split('|').map(c => c.trim()).filter(c => c));

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', marginBottom: '16px', fontSize: '12px' }}>
            <thead>
                <tr>
                    {headers.map((header, i) => (
                        <th key={i} style={{ border: '1px solid #E5E7EB', padding: '8px', textAlign: 'left', backgroundColor: '#F3F4F6' }}>{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {body.map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, j) => (
                            <td key={j} style={{ border: '1px solid #E5E7EB', padding: '8px' }}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

const MarkdownComponents = {
    h1: ({node, ...props}: any) => <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px' }} {...props} />,
    h2: ({node, ...props}: any) => <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '12px' }} {...props} />,
    h3: ({node, ...props}: any) => <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px', marginBottom: '10px' }} {...props} />,
    ul: ({node, ...props}: any) => <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '10px 0' }} {...props} />,
    ol: ({node, ...props}: any) => <ol style={{ listStyleType: 'decimal', paddingLeft: '20px', margin: '10px 0' }} {...props} />,
    li: ({node, ...props}: any) => <li style={{ marginBottom: '4px' }} {...props} />,
};

export function LifeScienceExport({ content, userMessage }: { content: any, userMessage: string }) {
    if (!content) return null;

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#111827', padding: '40px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                 <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '40px',
                    width: '40px',
                    borderRadius: '9999px',
                    backgroundColor: '#E0E7FF'
                 }}>
                    <Bot style={{ height: '24px', width: '24px', color: '#4F46E5' }} />
                 </div>
                 <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Life Science Chatbot Response</h1>
            </div>

            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#6B7280', marginBottom: '8px' }}>Your Prompt:</h2>
                <p style={{ fontStyle: 'italic', color: '#4B5563' }}>"{userMessage}"</p>
            </div>
            
            <hr style={{ borderTop: '1px solid #E5E7EB', margin: '32px 0' }} />

            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                {content.parts.map((part: any, index: number) => {
                    switch (part.type) {
                        case 'text':
                            return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{part.content}</ReactMarkdown>;
                        case 'table':
                            return <TableRenderer key={index} content={part.content} />;
                        case 'code':
                            return (
                                <pre key={index} style={{ backgroundColor: '#F3F4F6', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                                    <code>{part.content}</code>
                                </pre>
                            );
                        case 'callout':
                            return <Callout key={index} type={part.calloutType || 'info'}>{part.content}</Callout>;
                        case 'math':
                            return (
                                <div key={index} style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
                                    <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '16px', textAlign: 'center', color: '#4338CA' }}>
                                        {part.content}
                                    </p>
                                </div>
                            );
                        case 'divider':
                            return <hr key={index} style={{ borderTop: '1px solid #E5E7EB', margin: '24px 0' }} />;
                        default:
                            return null;
                    }
                })}
            </div>
        </div>
    );
}
