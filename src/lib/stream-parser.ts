

export type ParsedContentPart = {
    type: 'text' | 'table' | 'code' | 'callout' | 'divider' | 'diagram' | 'math' | 'action' | 'tool' | 'search_results' | 'questions';
    content: any;
    language?: string;
    calloutType?: string;
    diagramType?: string;
};
 
export type WebSearchResult = {
    position: number;
    title: string;
    url: string;
    favicon_url: string;
    snippet: string;
    domain: string;
}
 
export type WebSearchData = {
    query: string;
    results: WebSearchResult[];
}
 
export type ParsedStreamData = {
    type: 'metadata' | 'content' | 'notes' | 'report' | 'questions' | 'steps' | 'action' | 'tool' | 'search_results' | 'math';
    subType?: 'text' | 'table' | 'code' | 'callout' | 'divider' | 'diagram' | 'math' | 'action' | 'tool' | 'search_results' | 'questions';
    chatroom_id?: string;
    has_new_chat_created?: boolean;
    chat_title?: string;
    chunk?: string;
    content?: any;
    language?: string;
    calloutType?: string;
    diagramType?: string;
    parts?: ParsedContentPart[];

    // Tool / search payload fields. The parser spreads the server's JSON
    // straight into the emitted object (`onParse({ ...jsonData, type })`), so
    // these arrive at runtime for tool and search_results events. They are
    // declared here because consumers read them; without that the readers
    // failed to compile and the production build could not run.
    action_detail?: string;
    action_details?: unknown;
    tool_name?: string;
    tool_input?: unknown;
    query?: string;
    search_engine?: string;
    total_results?: number;
    results?: WebSearchResult[];
    featured_snippet?: unknown;
};
 
export class StreamParser {
    private buffer = '';
    private state: 'content' | 'notes' | 'report' | 'questions' | 'steps' | 'action' | 'tool' | 'search_results' | 'math' = 'content';
    private wordBuffer = '';
 
    private markers = {
        notes: { start: '[NOTES]', end: '[/NOTES]' },
        report: { start: '[REPORT]', end: '[/REPORT]' },
        questions: { start: '[QUESTIONS_TO_ASK_START]', end: '[QUESTIONS_TO_ASK_END]' },
        steps: { start: 'STEP_START', end: 'STEP_END' },
        action: { start: '[ACTION]', end: '[/ACTION]' },
        tool: { start: '[TOOL_START]', end: '[TOOL_END]' },
        search_results: { start: '[SEARCH_RESULTS]', end: '[/SEARCH_RESULTS]' },
        math: { start: '[MATH_START]', end: '[MATH_END]' }
    };
 
    // This method is for parsing the final, complete content string into structured parts.
    public parseContent(content: string): ParsedContentPart[] {
        const parts: ParsedContentPart[] = [];
        const regex = /(TABLE_START|CODE_START:[a-zA-Z]+|CALLOUT_START:[a-zA-Z]+|DIAGRAM_START:[a-zA-Z]+|\[TOOL_START\]|\[SEARCH_RESULTS\]|\[QUESTIONS_TO_ASK_START\]|\[MATH_START\])/g;
 
        let lastIndex = 0;
        let match;
 
        while ((match = regex.exec(content)) !== null) {
            const preContent = content.substring(lastIndex, match.index).trim();
            if (preContent) {
                const cleanedPreContent = this.stripResidualMarkers(preContent).trim();
                if (cleanedPreContent) {
                    parts.push({ type: 'text', content: cleanedPreContent });
                }
            }
 
            const marker = match[0];
            
            const endMarker = this.getEndMarker(marker);
            const endMarkerIndex = content.indexOf(endMarker, match.index);
 
            if (endMarkerIndex !== -1) {
                const blockContent = content.substring(match.index + marker.length, endMarkerIndex);
                
                // Special handling for TOOL_START: keep SEARCH_RESULTS inside it
                if (marker === '[TOOL_START]') {
                    // Keep the raw content with SEARCH_RESULTS inside
                    const part = { type: 'tool' as const, content: blockContent.trim() };
                    parts.push(part);
                } else {
                    const part = this.createContentPart(marker, blockContent);
                    if (part) parts.push(part);
                }
                
                lastIndex = endMarkerIndex + endMarker.length;
                regex.lastIndex = lastIndex;
            } else {
                lastIndex = content.length;
                break;
            }
        }
 
        if (lastIndex < content.length) {
            const remainingContent = content.substring(lastIndex).trim();
            if (remainingContent) {
                const cleanedRemainingContent = this.stripResidualMarkers(remainingContent).trim();
                if (cleanedRemainingContent) {
                    parts.push({ type: 'text', content: cleanedRemainingContent });
                }
            }
        }
        return parts;
    }
   
    private stripResidualMarkers(text: string): string {
        return text
            .replace(/\[NOTES\]/g, '')
            .replace(/\[\/NOTES\]/g, '')
            .replace(/\[REPORT\]/g, '')
            .replace(/\[\/REPORT\]/g, '')
            .replace(/\[REPORT_START\]/g, '')
            .replace(/\[REPORT_END\]/g, '')
            .replace(/\[QUESTIONS_TO_ASK_START\]/g, '')
            .replace(/\[QUESTIONS_TO_ASK_END\]/g, '')
            .replace(/\[TOOL_START\]/g, '')
            .replace(/\[TOOL_END\]/g, '')
            .replace(/\[SEARCH_RESULTS\]/g, '')
            .replace(/\[\/SEARCH_RESULTS\]/g, '')
            .replace(/\[ACTION\]/g, '')
            .replace(/\[\/ACTION\]/g, '')
            .replace(/\[MATH_START\]/g, '')
            .replace(/\[MATH_END\]/g, '');
    }

     private getEndMarker(startMarker: string): string {
        if (startMarker.startsWith('TABLE_START')) return 'TABLE_END';
        if (startMarker.startsWith('CODE_START')) return 'CODE_END';
        if (startMarker.startsWith('CALLOUT_START')) return 'CALLOUT_END';
        if (startMarker.startsWith('DIAGRAM_START')) return 'DIAGRAM_END';
        if (startMarker === '[TOOL_START]') return '[TOOL_END]';
        if (startMarker === '[SEARCH_RESULTS]') return '[/SEARCH_RESULTS]';
        if (startMarker === '[QUESTIONS_TO_ASK_START]') return '[QUESTIONS_TO_ASK_END]';
        if (startMarker === '[MATH_START]') return '[MATH_END]';
        return '';
    }
 
    private createContentPart(marker: string, blockContent: string): ParsedContentPart | null {
        if (marker.startsWith('TABLE_START')) {
            return { type: 'table', content: blockContent };
        }
        if (marker.startsWith('CODE_START')) {
            const language = marker.split(':')[1] || 'text';
            return { type: 'code', content: blockContent, language };
        }
        if (marker.startsWith('CALLOUT_START')) {
            const calloutType = marker.split(':')[1]?.trim().toLowerCase() || 'info';
            return { type: 'callout', content: blockContent, calloutType };
        }
        if (marker.startsWith('DIAGRAM_START')) {
            const diagramType = marker.split(':')[1]?.trim().toLowerCase() || 'mermaid';
            const trimmedContent = blockContent.trim();
            const sanitizedContent = this.sanitizeMermaidContent(trimmedContent);
            return { type: 'diagram', content: sanitizedContent, diagramType };
        }
        if (marker === '[TOOL_START]') {
            // Keep the full content including SEARCH_RESULTS - ResearchToolCard will handle parsing
            return { type: 'tool', content: blockContent.trim() };
        }
        if (marker === '[SEARCH_RESULTS]') {
            try {
                const searchData = JSON.parse(blockContent.trim());
                return { type: 'search_results', content: searchData };
            } catch (e) {
                console.warn('Failed to parse search results JSON:', e);
                return { type: 'search_results', content: blockContent.trim() };
            }
        }
        if (marker === '[QUESTIONS_TO_ASK_START]') {
            return { type: 'questions', content: blockContent.trim() };
        }
        if (marker === '[MATH_START]') {
            return { type: 'math', content: blockContent.trim() };
        }
        return null;
    }
   
    private sanitizeMermaidContent(content: string): string {
        return content
            .split('\n')
            .map(line => line.replace(/\r$/, ''))
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
    }

    private simpleMarkdownToHtml(markdown: string): string {
        return markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
 
    public renderTableToHtml(markdown: string): string {
        const rows = markdown.trim().split('\n');
        if (rows.length < 2) return `<table></table>`;
 
        const headerRow = rows[0];
        const bodyRows = rows.slice(2);
       
        const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
       
        let html = '<table style="width: 100%; border-collapse: collapse;"><thead><tr>';
        headers.forEach(h => {
            const headerHtml = this.simpleMarkdownToHtml(h);
            html += `<th style="border: 1px solid hsl(var(--border)); padding: 8px; text-align: left; background-color: hsl(var(--muted));">${headerHtml}</th>`;
        });
        html += '</tr></thead><tbody>';
 
        bodyRows.forEach(rowStr => {
            const cells = rowStr.split('|').map(c => c.trim()).filter(Boolean);
            html += '<tr>';
            cells.forEach(c => {
                 const cellHtml = this.simpleMarkdownToHtml(c);
                 html += `<td style="border: 1px solid hsl(var(--border)); padding: 8px;">${cellHtml}</td>`;
            });
            html += '</tr>';
        });
 
        html += '</tbody></table>';
        return html;
    }
 
    public parse(streamChunk: string, onParse: (data: ParsedStreamData) => void): void {
        const lines = streamChunk.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine) continue;
            if (trimmedLine === '[DONE]' || trimmedLine === 'data: [DONE]' || trimmedLine === 'data:[DONE]') continue;

            let content = trimmedLine;
            if (trimmedLine.startsWith('data:')) {
                content = trimmedLine.substring(5).trim();
            }

            if (!content) continue;

            if (content.startsWith('{') && content.endsWith('}')) {
                try {
                    const jsonData = JSON.parse(content);

                    if (jsonData.type === 'done' || jsonData.chatroom_id || jsonData.has_new_chat_created || jsonData.chat_title) {
                        if (this.wordBuffer) {
                            this.buffer += this.wordBuffer;
                            this.wordBuffer = '';
                        }
                        onParse({ type: 'metadata', ...jsonData });
                        continue;
                    }

                    if (jsonData.type && jsonData.chunk !== undefined) {
                        const chunkContent = typeof jsonData.chunk === 'string' ? jsonData.chunk : String(jsonData.chunk);

                        for (let i = 0; i < chunkContent.length; i++) {
                            const char = chunkContent[i];
                            if (char === ' ' || char === '\n' || char === '\t') {
                                if (this.wordBuffer) {
                                    this.buffer += this.wordBuffer;
                                    this.wordBuffer = '';
                                }
                                this.buffer += char;
                            } else {
                                this.wordBuffer += char;
                            }
                        }

                        this.processBuffer(onParse);
                        continue;
                    }

                    onParse(jsonData);
                    continue;
                } catch (e) {
                    // fall through to treat as plain text
                }
            }

            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                if (char === ' ' || char === '\n' || char === '\t') {
                    if (this.wordBuffer) {
                        this.buffer += this.wordBuffer;
                        this.wordBuffer = '';
                    }
                    this.buffer += char;
                } else {
                    this.wordBuffer += char;
                }
            }

            this.processBuffer(onParse);
        }
    }
   
    private processBuffer(onParse: (data: ParsedStreamData) => void): void {
        let running = true;

        while (running) {
            if (this.state === 'content') {
                const markerPositions = [
                    { type: 'notes' as const, index: this.buffer.indexOf(this.markers.notes.start) },
                    { type: 'report' as const, index: this.buffer.indexOf(this.markers.report.start) },
                    { type: 'questions' as const, index: this.buffer.indexOf(this.markers.questions.start) },
                    { type: 'steps' as const, index: this.buffer.indexOf(this.markers.steps.start) },
                    { type: 'action' as const, index: this.buffer.indexOf(this.markers.action.start) },
                    { type: 'tool' as const, index: this.buffer.indexOf(this.markers.tool.start) },
                    { type: 'search_results' as const, index: this.buffer.indexOf(this.markers.search_results.start) },
                    { type: 'math' as const, index: this.buffer.indexOf(this.markers.math.start) }
                ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

                if (markerPositions.length > 0) {
                    const firstMarker = markerPositions[0];
                    const markerIndex = firstMarker.index;

                    if (markerIndex > 0) {
                        const contentBeforeMarker = this.buffer.substring(0, markerIndex);
                        this.emitChunks(contentBeforeMarker, 'content', onParse);
                    }

                    this.buffer = this.buffer.substring(markerIndex + this.markers[firstMarker.type].start.length);
                    this.state = firstMarker.type;
                    continue;
                }
            } else {
                const endMarker = this.markers[this.state].end;
                const endMarkerIndex = this.buffer.indexOf(endMarker);

                if (endMarkerIndex !== -1) {
                    if (endMarkerIndex > 0) {
                        const blockContent = this.buffer.substring(0, endMarkerIndex);
                        this.emitChunks(blockContent, this.state, onParse);
                    }

                    this.buffer = this.buffer.substring(endMarkerIndex + endMarker.length);
                    this.state = 'content';
                    continue;
                }
            }

            if (this.buffer) {
                this.emitChunks(this.buffer, this.state, onParse);
                this.buffer = '';
            }

            running = false;
        }
    }
   
    private emitChunks(data: string, type: 'content' | 'steps' | 'questions' | 'notes' | 'report' | 'action' | 'tool' | 'search_results' | 'math', onParse: (data: ParsedStreamData) => void) {
        if (!data) return;

        const segments = this.splitJsonAndTextSegments(data);

        segments.forEach((segment) => {
            if (segment.kind === 'text') {
                const chunkText = type === 'content' ? this.stripResidualMarkers(segment.value) : segment.value;
                if (chunkText.trim()) {
                    onParse({ type, subType: 'text', chunk: chunkText });
                }
                return;
            }

            const jsonString = segment.value.trim();
            if (!jsonString) return;

            try {
                const jsonData = JSON.parse(jsonString);
                const emittedType = (jsonData.type && typeof jsonData.type === 'string' ? jsonData.type : type) as ParsedStreamData['type'];
                onParse({ ...jsonData, type: emittedType });
            } catch {
                const fallbackText = type === 'content' ? this.stripResidualMarkers(jsonString) : jsonString;
                if (fallbackText.trim()) {
                    onParse({ type, subType: 'text', chunk: fallbackText });
                }
            }
        });
    }

    private splitJsonAndTextSegments(data: string): Array<{ kind: 'json' | 'text'; value: string }> {
        const segments: Array<{ kind: 'json' | 'text'; value: string }> = [];
        let currentText = '';
        let depth = 0;
        let inString = false;
        let escape = false;
        let jsonStart = -1;

        for (let i = 0; i < data.length; i++) {
            const char = data[i];

            if (depth === 0) {
                if (char === '{') {
                    if (currentText) {
                        segments.push({ kind: 'text', value: currentText });
                        currentText = '';
                    }
                    depth = 1;
                    inString = false;
                    escape = false;
                    jsonStart = i;
                } else {
                    currentText += char;
                }
                continue;
            }

            if (char === '\\' && !escape) {
                escape = true;
            } else {
                if (char === '"' && !escape) {
                    inString = !inString;
                }
                escape = false;
            }

            if (!inString) {
                if (char === '{') {
                    depth += 1;
                } else if (char === '}') {
                    depth -= 1;
                }
            }

            if (depth === 0 && jsonStart !== -1) {
                const jsonString = data.slice(jsonStart, i + 1);
                segments.push({ kind: 'json', value: jsonString });
                jsonStart = -1;
            }
        }

        if (depth > 0 && jsonStart !== -1) {
            currentText += data.slice(jsonStart);
        }

        if (currentText) {
            segments.push({ kind: 'text', value: currentText });
        }

        return segments;
    }

    public flush(onParse: (data: ParsedStreamData) => void) {
        if (this.wordBuffer) {
            this.buffer += this.wordBuffer;
            this.wordBuffer = '';
        }

        if (this.buffer) {
            this.emitChunks(this.buffer, this.state, onParse);
            this.buffer = '';
        }
    }
   
    public getFinalContent(aiResponse: string): string {
        const toolCallEndMarker = "TOOL_CALL_END:web_search";
        const stepStartMarker = "STEP_START";
        let contentAfterToolCall = aiResponse;
 
        // Strip out everything before the last tool call end marker
        const lastToolEndIndex = aiResponse.lastIndexOf(toolCallEndMarker);
        if (lastToolEndIndex !== -1) {
            contentAfterToolCall = aiResponse.substring(lastToolEndIndex + toolCallEndMarker.length);
        }
 
        // Strip out all TOOL_START...TOOL_END blocks (rendered separately via cards)
        contentAfterToolCall = contentAfterToolCall.replace(/\[TOOL_START\][\s\S]*?\[TOOL_END\]/g, '');

        // Strip out all standalone SEARCH_RESULTS blocks (they are surfaced in cards)
        contentAfterToolCall = contentAfterToolCall.replace(/\[SEARCH_RESULTS\][\s\S]*?\[\/SEARCH_RESULTS\]/g, '');

        // Strip out ACTION blocks entirely since they contain metadata only
        contentAfterToolCall = contentAfterToolCall.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '');
 
        // Strip out all step markers
        let stepStartIndex = contentAfterToolCall.indexOf(stepStartMarker);
        while (stepStartIndex !== -1) {
            const stepEndMarker = "STEP_END";
            const stepEndIndex = contentAfterToolCall.indexOf(stepEndMarker, stepStartIndex);
            if (stepEndIndex !== -1) {
                // Remove the step block
                contentAfterToolCall = contentAfterToolCall.substring(0, stepStartIndex) + contentAfterToolCall.substring(stepEndIndex + stepEndMarker.length);
            } else {
                // If there's no end marker, just remove the start marker and whatever is left
                contentAfterToolCall = contentAfterToolCall.substring(0, stepStartIndex);
            }
            stepStartIndex = contentAfterToolCall.indexOf(stepStartMarker);
        }
        
        // Remove any remaining stray markers
        contentAfterToolCall = contentAfterToolCall.replace(/\[TOOL_END\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[\/TOOL_END\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[TOOL_START\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[SEARCH_RESULTS\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[\/SEARCH_RESULTS\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[QUESTIONS_TO_ASK_START\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[QUESTIONS_TO_ASK_END\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[NOTES\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[\/NOTES\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[REPORT\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[\/REPORT\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[REPORT_START\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[REPORT_END\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[MATH_START\]/g, '');
        contentAfterToolCall = contentAfterToolCall.replace(/\[MATH_END\]/g, '');
 
        return contentAfterToolCall.trim();
    }

    // Clean streaming text by removing marker blocks that haven't been parsed yet
    public cleanStreamingText(text: string): string {
        let cleaned = text;

        // Remove complete tool blocks (they are rendered as cards)
        cleaned = cleaned.replace(/\[TOOL_START\][\s\S]*?\[TOOL_END\]/g, '');

        // Remove complete search result blocks (rendered in cards)
        cleaned = cleaned.replace(/\[SEARCH_RESULTS\][\s\S]*?\[\/SEARCH_RESULTS\]/g, '');

        // Remove [ACTION]...[/ACTION] blocks
        cleaned = cleaned.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '');
        
        // Remove incomplete [ACTION] (still being streamed)
        cleaned = cleaned.replace(/\[ACTION\][\s\S]*$/g, '');

        // Guard against incomplete tool or search markers still streaming
        cleaned = cleaned.replace(/\[TOOL_START\][\s\S]*$/g, '');
        cleaned = cleaned.replace(/\[SEARCH_RESULTS\][\s\S]*$/g, '');
        cleaned = cleaned.replace(/\[MATH_START\][\s\S]*$/g, '');

        // Remove any stray markers (even if incomplete)
        cleaned = cleaned.replace(/\[TOOL_END\]/g, '');
        cleaned = cleaned.replace(/\[\/TOOL_END\]/g, '');
        cleaned = cleaned.replace(/\[TOOL_START\]/g, '');
        cleaned = cleaned.replace(/\[SEARCH_RESULTS\]/g, '');
        cleaned = cleaned.replace(/\[\/SEARCH_RESULTS\]/g, '');
        cleaned = cleaned.replace(/\[QUESTIONS_TO_ASK_START\]/g, '');
        cleaned = cleaned.replace(/\[QUESTIONS_TO_ASK_END\]/g, '');
        cleaned = cleaned.replace(/\[NOTES\]/g, '');
        cleaned = cleaned.replace(/\[\/NOTES\]/g, '');
        cleaned = cleaned.replace(/\[REPORT\]/g, '');
        cleaned = cleaned.replace(/\[\/REPORT\]/g, '');
        cleaned = cleaned.replace(/\[REPORT_START\]/g, '');
        cleaned = cleaned.replace(/\[REPORT_END\]/g, '');
        cleaned = cleaned.replace(/\[MATH_START\]/g, '');
        cleaned = cleaned.replace(/\[MATH_END\]/g, '');
        cleaned = cleaned.replace(/\[ACTION\]/g, '');
        cleaned = cleaned.replace(/\[\/ACTION\]/g, '');

        return cleaned.trim();
    }
}

