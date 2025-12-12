import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Globe, Database, Code } from 'lucide-react';

interface ToolAction {
  tool_name: string;
  tool_input?: string;
}

interface ResearchToolStreamingProps {
  action?: ToolAction;
  content?: string;
  className?: string;
}

const getToolIcon = (toolName: string) => {
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

const getToolLabel = (toolName: string) => {
  switch (toolName?.toLowerCase()) {
    case 'web_search':
      return 'Searching the web';
    case 'database_query':
      return 'Querying database';
    case 'code_execution':
      return 'Executing code';
    default:
      return `Running ${toolName}`;
  }
};

export const ResearchToolStreaming: React.FC<ResearchToolStreamingProps> = ({ 
  action, 
  content,
  className = '' 
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!action) return null;

  const Icon = getToolIcon(action.tool_name);
  const label = getToolLabel(action.tool_name);

  return (
    <Card 
      className={`my-4 border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}
    >
      <CardHeader className="pb-3">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Icon className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{label}{dots}</span>
              <Badge variant="secondary" className="text-xs animate-pulse">
                Running
              </Badge>
            </div>
            {action.tool_input && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {action.tool_input}
              </p>
            )}
          </div>
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
        </div>
      </CardHeader>
      {content && (
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {content}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
