import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Globe, CheckCircle, Database, Code, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchResultsCard } from './search-results-card';

export interface ToolAction {
  tool_name: string;
  tool_input?: string;
  // 'failed' and 'error' are reported by the server and already
  // rendered by the deep-research page; the union omitted them.
  status?: 'running' | 'completed' | 'failed' | 'error';
}

interface ResearchToolCardProps {
  content: string;
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
      return 'Web Search';
    case 'database_query':
      return 'Database Query';
    case 'code_execution':
      return 'Code Execution';
    default:
      return toolName || 'Tool';
  }
};

export interface SearchResultsData {
  query: string;
  search_engine: string;
  total_results: number;
  results: any[];
  featured_snippet?: any;
}

export const parseToolContent = (content: string): { 
  actions: ToolAction[], 
  searchResults: SearchResultsData[], 
  remainingContent: string 
} => {
  const actions: ToolAction[] = [];
  const searchResults: SearchResultsData[] = [];
  let remainingContent = content;

  // Parse [ACTION]...[/ACTION] blocks
  const actionRegex = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g;
  const actionMatches = content.matchAll(actionRegex);
  for (const match of actionMatches) {
    const actionContent = match[1]?.trim();
    if (!actionContent) continue;
    try {
      const actionData = JSON.parse(actionContent);
      actions.push({ ...actionData, status: 'completed' });
    } catch (e) {
      console.warn('Failed to parse action:', actionContent);
    }
  }

  // Parse [SEARCH_RESULTS]...[/SEARCH_RESULTS] blocks
  const searchRegex = /\[SEARCH_RESULTS\]([\s\S]*?)\[\/SEARCH_RESULTS\]/g;
  const searchMatches = content.matchAll(searchRegex);
  for (const match of searchMatches) {
    const searchContent = match[1]?.trim();
    if (!searchContent) continue;
    try {
      const searchData = JSON.parse(searchContent);
      searchResults.push(searchData);
    } catch (e) {
      console.warn('Failed to parse search results:', e);
    }
  }

  // Remove all markers from content to get remaining markdown
  const actionRemovalRegex = /\[ACTION\][\s\S]*?\[\/ACTION\]/g;
  const searchRemovalRegex = /\[SEARCH_RESULTS\][\s\S]*?\[\/SEARCH_RESULTS\]/g;
  remainingContent = remainingContent.replace(actionRemovalRegex, '').trim();
  remainingContent = remainingContent.replace(searchRemovalRegex, '').trim();
  remainingContent = remainingContent.replace(/\[TOOL_END\]/g, '').trim();
  remainingContent = remainingContent.replace(/\[\/TOOL_END\]/g, '').trim();

  return { actions, searchResults, remainingContent };
};

export const ResearchToolCard: React.FC<ResearchToolCardProps> = ({ content, className = '' }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const { actions, searchResults, remainingContent } = parseToolContent(content);
  
  useEffect(() => {
    // Smooth entrance animation
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card 
      className={`my-4 border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-primary/10 transition-all duration-300 ease-out ${
        isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      } ${className}`}
    >
      {actions.length > 0 && (
        <CardHeader className="pb-3">
          <div className="space-y-2">
            {actions.map((action, index) => {
              const Icon = getToolIcon(action.tool_name);
              const label = getToolLabel(action.tool_name);
              
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-left-2 duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{label}</span>
                      <Badge variant="secondary" className="text-xs">
                        Completed
                      </Badge>
                    </div>
                    {action.tool_input && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {action.tool_input}
                      </p>
                    )}
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                </div>
              );
            })}
          </div>
        </CardHeader>
      )}
      
      <CardContent className={actions.length > 0 ? 'pt-0' : 'pt-4'}>
        {/* Render search results inside the tool card */}
        {searchResults.map((searchData, index) => (
          <div key={index} className="mb-4">
            <SearchResultsCard data={searchData} className="my-0 border-0 bg-transparent" />
          </div>
        ))}
        
        {/* Render remaining content */}
        {remainingContent && (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {remainingContent}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
