import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Globe, ExternalLink, ArrowRight, Info, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  parseToolContent,
  type ToolAction,
  type SearchResultsData,
} from './research-tool-card';

const formatEngineLabel = (engine?: string) => {
  if (!engine) return 'Search Engine';
  return engine.replace(/_/g, ' ').trim();
};

const buildQueryChips = (actions: ToolAction[], searchResults: SearchResultsData[]) => {
  const queries = new Set<string>();

  actions.forEach(action => {
    if (action.tool_input) {
      queries.add(action.tool_input);
    }
  });

  searchResults.forEach(result => {
    if (result.query) {
      queries.add(result.query);
    }
  });

  return Array.from(queries);
};

const renderSearchResult = (result: any, index: number) => {
  return (
    <a
      key={`${result.url}-${index}`}
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
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
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2">
              {result.domain && (
                <span className="truncate text-xs text-muted-foreground">
                  {result.domain}
                </span>
              )}
              {typeof result.position === 'number' && (
                <Badge variant="outline" className="text-xs">
                  #{result.position}
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {result.title}
            </p>
            {result.snippet && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                {result.snippet}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <span className="truncate">{result.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};

const renderSearchSection = (searchResults: SearchResultsData[]) => {
  if (searchResults.length === 0) return null;

  return (
    <div className="space-y-4">
      {searchResults.map((block, blockIndex) => {
        const results = Array.isArray(block.results) ? block.results : [];
        const featuredSnippet = block.featured_snippet;

        return (
          <div
            key={`${block.query}-${blockIndex}`}
            className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Layers className="h-4 w-4" />
                <span>{formatEngineLabel(block.search_engine)}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {block.total_results ?? results.length} {results.length === 1 ? 'result' : 'results'}
              </Badge>
            </div>

            {featuredSnippet && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <Info className="h-3.5 w-3.5" />
                  Featured Snippet
                </div>
                <p className="text-sm text-foreground">{featuredSnippet}</p>
              </div>
            )}

            <div className="space-y-3">
              {results.slice(0, 6).map((result, index) => renderSearchResult(result, index))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const renderQueriesSection = (queries: string[]) => {
  if (queries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Search Queries
      </div>
      <div className="flex flex-wrap gap-2">
        {queries.map(query => (
          <Badge key={query} variant="outline" className="border-primary/30 bg-primary/10 text-xs text-primary">
            {query}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const renderSummarySection = (remainingContent: string) => {
  if (!remainingContent) return null;

  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{remainingContent}</ReactMarkdown>
    </div>
  );
};

export type DeepResearchToolCardProps = {
  content: string;
  className?: string;
};

export const DeepResearchToolCard: React.FC<DeepResearchToolCardProps> = ({ content, className = '' }) => {
  const { actions, searchResults, remainingContent } = parseToolContent(content);
  const queries = buildQueryChips(actions, searchResults);
  const totalSources = searchResults.reduce((sum, block) => sum + (Array.isArray(block.results) ? block.results.length : 0), 0);

  const hasAnyContent = Boolean(remainingContent || queries.length > 0 || searchResults.length > 0);
  if (!hasAnyContent) return null;

  return (
    <Card className={`my-4 border border-border/50 bg-background/80 shadow-lg shadow-primary/10 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-primary">
            <ArrowRight className="h-4 w-4" />
            Research Artifact
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {totalSources} source{totalSources === 1 ? '' : 's'} referenced
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderSummarySection(remainingContent)}
        {renderQueriesSection(queries)}
        {renderSearchSection(searchResults)}
      </CardContent>
    </Card>
  );
};
