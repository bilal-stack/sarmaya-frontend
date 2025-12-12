import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchResult {
  position: number;
  title: string;
  url: string;
  favicon_url: string;
  snippet: string;
  domain: string;
  thumbnail?: string | null;
}

interface SearchResultsData {
  query: string;
  search_engine: string;
  total_results: number;
  results: SearchResult[];
  featured_snippet?: any;
}

interface SearchResultsCardProps {
  data: SearchResultsData | string;
  className?: string;
}

export const SearchResultsCard: React.FC<SearchResultsCardProps> = ({ data, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Parse data if it's a string
  let searchData: SearchResultsData;
  try {
    searchData = typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    console.error('Failed to parse search results:', e);
    return null;
  }

  const { query, search_engine, total_results, results, featured_snippet } = searchData;

  return (
    <Card 
      className={`my-4 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-blue-600/10 animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 shrink-0">
              <Search className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold">Search Results</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {total_results} {total_results === 1 ? 'result' : 'results'}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {search_engine}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 break-words">
                Query: <span className="font-medium text-foreground">"{query}"</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-3">
          {featured_snippet && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">Featured Snippet</span>
              </div>
              <p className="text-sm text-foreground">{featured_snippet}</p>
            </div>
          )}

          {results.map((result, index) => (
            <a
              key={result.position}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div 
                className="p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted hover:border-primary/50 transition-all duration-200 hover:shadow-md animate-in fade-in slide-in-from-left-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  {/* Favicon */}
                  <div className="shrink-0 mt-1">
                    {result.favicon_url ? (
                      <img 
                        src={result.favicon_url} 
                        alt="" 
                        className="h-5 w-5 rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Domain */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {result.domain}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        #{result.position}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                      {result.title}
                    </h4>

                    {/* Snippet */}
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {result.snippet}
                    </p>

                    {/* URL */}
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs text-blue-500 group-hover:underline truncate">
                        {result.url}
                      </span>
                      <ExternalLink className="h-3 w-3 text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Thumbnail if available */}
                  {result.thumbnail && (
                    <img 
                      src={result.thumbnail} 
                      alt=""
                      className="h-16 w-16 rounded object-cover shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </div>
            </a>
          ))}

          {results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No search results found</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
