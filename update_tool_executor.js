const fs = require('fs');

// Add web search execution to toolExecutor.ts
let content = fs.readFileSync('src/ai/toolExecutor.ts', 'utf8');

// Add import
content = content.replace(
  'import { windowRegistry } from \'./windowRegistry\';',
  'import { windowRegistry } from \'./windowRegistry\';\nimport { GeminiSearchClient } from \'./geminiSearchClient\';'
);

// Add to types import
content = content.replace(
  'import { Task, OpenWindowParams, CloseWindowParams } from \'./types\';',
  'import { Task, OpenWindowParams, CloseWindowParams, WebSearchParams } from \'./types\';'
);

// Add to constructor
content = content.replace(
  'export class ToolExecutor {',
  'export class ToolExecutor {\n  private geminiSearchClient: GeminiSearchClient;\n\n  constructor() {\n    try {\n      this.geminiSearchClient = new GeminiSearchClient();\n    } catch (error) {\n      console.warn(\'[ToolExecutor] Gemini search not available:\', error);\n    }\n  }'
);

// Add case for web_search
content = content.replace(
  'case \'close_window\':\n          result = await this.executeCloseWindow(task);\n          break;',
  'case \'close_window\':\n          result = await this.executeCloseWindow(task);\n          break;\n        \n        case \'web_search\':\n          result = await this.executeWebSearch(task);\n          break;'
);

// Add executeWebSearch method before generateWindowId
const webSearchMethod = `
  private async executeWebSearch(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as WebSearchParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'web_search', params });

    try {
      if (!this.geminiSearchClient) {
        throw new Error('Gemini search client not available. Check GEMINI_API_KEY.');
      }

      // Validate parameters
      if (!params.query) {
        throw new Error('Missing required parameter: query');
      }

      const resultCount = params.resultCount || 5;
      const displayMode = params.displayMode || 'auto';

      // Perform search
      const searchResults = await this.geminiSearchClient.searchWithGrounding(
        params.query, 
        resultCount
      );

      if (searchResults.length === 0) {
        throw new Error('No search results found');
      }

      // Determine display mode
      let finalDisplayMode = displayMode;
      if (displayMode === 'auto') {
        finalDisplayMode = searchResults.length === 1 ? 'summary' : 'links';
      }

      // Generate window content based on display mode
      let windowContent = '';
      let windowTitle = \`Search: \${params.query}\`;

      if (finalDisplayMode === 'summary' && searchResults[0]) {
        const result = searchResults[0];
        windowContent = \`**\${result.title}**

\${result.content || result.snippet}

Source: \${result.url}\`;
      } else if (finalDisplayMode === 'full' && searchResults[0]) {
        const result = searchResults[0];
        windowContent = \`# \${result.title}

\${result.content || result.snippet}

---
**Source:** \${result.url}\`;
      } else {
        // Links mode - multiple results
        windowContent = \`**Search Results for "\${params.query}"**

\${searchResults.map((result, index) => 
  \`\${index + 1}. **\${result.title}**
   \${result.snippet}
   🔗 \${result.url}
\`).join('\\n\\n')}

Found \${searchResults.length} result\${searchResults.length === 1 ? '' : 's'}\`;
      }

      // Generate a unique window ID
      const windowId = this.generateWindowId();

      // Create window data
      const windowData = {
        id: windowId,
        type: 'search-results',
        title: windowTitle,
        content: windowContent,
        position: { x: 150, y: 150 },
        size: { width: 600, height: 400 },
        context: {
          title: windowTitle,
          content: windowContent,
          type: 'search-results',
          metadata: {
            searchQuery: params.query,
            resultCount: searchResults.length,
            displayMode: finalDisplayMode,
            results: searchResults
          }
        },
        timestamp: Date.now()
      };

      // Emit to event bus for UI to handle
      eventBus.emit('ui:open_window', windowData);
      eventBus.emit('window:opened', windowData);

      // Forward to worker if needed
      try {
        if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
          (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
        }
      } catch (_) {
        // no-op
      }

      console.log(\`[ToolExecutor] Web search completed for: "\${params.query}"\`, windowData);

      const result = {
        taskId: task.id,
        success: true,
        result: {
          windowId: windowId,
          searchQuery: params.query,
          resultCount: searchResults.length,
          displayMode: finalDisplayMode,
          searchResults: searchResults
        },
        timestamp: Date.now()
      };

      eventBus.emit('ai:tool_call_completed', { task, tool: 'web_search', result });
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[ToolExecutor] Web search failed:', errorMsg);
      
      eventBus.emit('ai:tool_call_failed', { task, tool: 'web_search', error: errorMsg });
      
      return {
        taskId: task.id,
        success: false,
        error: errorMsg,
        timestamp: Date.now()
      };
    }
  }
`;

// Insert the method before generateWindowId
content = content.replace(
  '  private generateWindowId(): string {',
  webSearchMethod + '\n  private generateWindowId(): string {'
);

fs.writeFileSync('src/ai/toolExecutor.ts', content);
console.log('✅ Added web search execution to toolExecutor.ts');

