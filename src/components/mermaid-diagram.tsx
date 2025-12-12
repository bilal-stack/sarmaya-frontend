
'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from 'next-themes';

const diagramThemeVariables = {
  primaryColor: '#EBEDF0',
  secondaryColor: '#EBEDF0',
  tertiaryColor: '#FFFFFF',
  primaryBorderColor: '#8F9CB7',
  primaryTextColor: '#0F172A',
  lineColor: '#8F9CB7',
  edgeLabelBackground: '#FFFFFF',
};

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  themeVariables: diagramThemeVariables,
});

type MermaidDiagramProps = {
  chart: string;
};

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { theme } = useTheme();

  useEffect(() => {
    async function renderMermaid() {
      if (!chart) {
        console.log('No chart provided');
        return;
      }

      try {
        console.log('Rendering Mermaid diagram with chart:', chart);
        console.log('Chart length:', chart.length);
        
        // Unique ID for each render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        
        // Clean and fix the chart content
        let cleanChart = chart.trim();
        
        // Fix common Mermaid syntax issues from LLM-generated code
        
        // 1. Fix quadrantChart data points: Convert "Name" : x : y to Name: [x, y]
        if (cleanChart.startsWith('quadrantChart')) {
          console.log('Original quadrantChart:', cleanChart);
          // Replace incorrect colon-separated format with correct bracket format
          cleanChart = cleanChart.replace(/"([^"]+)"\s*:\s*(\d+\.?\d*)\s*:\s*(\d+\.?\d*)/g, '$1: [$2, $3]');
          // Also handle without quotes
          cleanChart = cleanChart.replace(/^(\s+)([A-Za-z][^\s:]+)\s*:\s*(\d+\.?\d*)\s*:\s*(\d+\.?\d*)/gm, '$1$2: [$3, $4]');
          console.log('Fixed quadrantChart:', cleanChart);
        }
        
        // 2. Fix flowchart node labels with parentheses - replace with HTML entities
        if (cleanChart.startsWith('flowchart')) {
          const hadParens = cleanChart.includes('(') && cleanChart.includes('[');
          if (hadParens) {
            console.log('Original flowchart (with parentheses):', cleanChart);
          }
          // Replace parentheses in square bracket labels with HTML entities
          cleanChart = cleanChart.replace(/\[([^\]]*?)\(([^\)]*?)\)([^\]]*?)\]/g, (match, before, inside, after) => {
            return `[${before}#40;${inside}#41;${after}]`;
          });
          if (hadParens) {
            console.log('Fixed flowchart:', cleanChart);
          }
        }
        
        console.log('Calling mermaid.render with id:', id);
        const result = await mermaid.render(id, cleanChart);
        console.log('Mermaid render result:', result);
        console.log('SVG from result:', result.svg);
        console.log('SVG length:', result.svg?.length);
        
        if (result.svg) {
          setSvg(result.svg);
          setError('');
          console.log('Mermaid diagram rendered successfully, SVG set');
        } else {
          console.error('No SVG in result');
          setError('No SVG generated from Mermaid');
        }
      } catch (error: any) {
        console.error("Mermaid rendering error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        setSvg('');
        setError(error.message || 'Failed to render diagram');
      }
    }
    renderMermaid();
  }, [chart]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      themeVariables: diagramThemeVariables,
    });
  }, [theme]);

  if (error) {
    const sanitizedSource = chart
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('error in text')) return false;
        if (lower.startsWith('syntax error in text')) return false;
        if (lower.includes('mermaid version')) return false;
        if (lower.includes('syntax error in')) return false;
        return true;
      })
      .join('\n');

    return (
      <div className="space-y-3 rounded-md border border-border/40 bg-muted/20 p-4">
        <p className="text-sm font-medium text-muted-foreground">Showing Mermaid source while the diagram preview is unavailable.</p>
        <div className="not-prose rounded-md bg-background/90 p-3 text-sm text-foreground">
          {sanitizedSource ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs text-muted-foreground">
              <code>{sanitizedSource}</code>
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">Mermaid source is unavailable.</p>
          )}
        </div>
      </div>
    );
  }

  console.log(svg);

  if (!svg) {
    return <div className="p-4 bg-muted rounded-md text-center">Loading diagram...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container flex justify-center items-center my-4 p-4 bg-azure rounded-md border border-border"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
