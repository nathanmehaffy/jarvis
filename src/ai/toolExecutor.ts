/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task, OpenWindowParams, CloseWindowParams, WebSearchParams, CreateGroupParams, AssignGroupParams } from './types';
import { eventBus } from '@/lib/eventBus';
import { windowRegistry } from './windowRegistry';
import { GeminiSearchClient } from './geminiSearchClient';

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}

export class ToolExecutor {
  private geminiSearchClient!: GeminiSearchClient;

  constructor() {
    try {
      this.geminiSearchClient = new GeminiSearchClient();
    } catch (error) {
      console.warn('[ToolExecutor] Gemini search not available:', error);
    }
  }
  async executeTasks(tasks: Task[]): Promise<ExecutionResult[]> {
    eventBus.emit('ai:task_queue_updated', tasks);
    const results: ExecutionResult[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);
      } catch (error) {
        const errorResult = {
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        };
        results.push(errorResult);
        eventBus.emit('ai:task_failed', { task, error: errorResult.error });
      }
    }
    
    return results;
  }

  private async executeTask(task: Task): Promise<ExecutionResult> {
    eventBus.emit('ai:task_started', { task });
    const startTime = Date.now();
    
    try {
      let result: ExecutionResult;
      switch (task.tool) {
        case 'open_window':
          result = await this.executeOpenWindow(task);
          break;
        
        case 'close_window':
          result = await this.executeCloseWindow(task);
          break;
        
        case 'web_search':
          result = await this.executeWebSearch(task);
          break;
        
        case 'open_webview':
          result = await this.executeOpenWebView(task);
          break;
        
        case 'create_group':
          result = await this.executeCreateGroup(task);
          break;
        
        case 'assign_group':
          result = await this.executeAssignGroup(task);
          break;

        case 'open_search_result':
          result = await this.executeOpenSearchResult(task);
          break;
        
        default:
          throw new Error(`Unknown tool: ${task.tool}`);
      }
      
      eventBus.emit('ai:task_completed', { task, result });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      eventBus.emit('ai:task_failed', { task, error: errorMsg });
      return {
        taskId: task.id,
        success: false,
        error: errorMsg,
        timestamp: Date.now() - startTime
      };
    }
  }

  private async executeOpenWindow(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as OpenWindowParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'open_window', params });
    
    // Validate parameters
    if (!params.windowType || !params.context) {
      throw new Error('Missing required parameters for open_window: windowType and context are required');
    }
    
    // Generate a unique window ID
    const windowId = this.generateWindowId();
    
    // Emit event to UI for window creation
    const windowData = {
      id: windowId,
      type: params.windowType,
      title: params.context.title || 'Untitled Window',
      content: params.context.content || '',
      position: params.context.position || { x: 100, y: 100 },
      size: params.context.size || { width: 300, height: 200 },
      context: params.context,
      timestamp: Date.now()
    };
    
    // Emit to event bus for UI to handle
    eventBus.emit('ui:open_window', windowData);
    
    // Also emit a general window event
    eventBus.emit('window:opened', windowData);

    // If running inside a Web Worker, forward to the main thread
    // so the UI (which listens on the main thread) can react.
    try {
      // In a worker, globalThis/self has postMessage and window is undefined
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
      }
    } catch (_) {
      // no-op if environment detection fails
    }
    
    console.log(`[ToolExecutor] Opening ${params.windowType} window:`, windowData);
    
    const result = {
      taskId: task.id,
      success: true,
      result: {
        windowId: windowId,
        windowType: params.windowType,
        context: params.context
      },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'open_window', result });
    return result;
  }

  private async executeCloseWindow(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as CloseWindowParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'close_window', params });

    // Resolve selector to actual window ID if needed
    let targetWindowId = params.windowId;
    if (!targetWindowId && params.selector) {
      if (params.selector === 'newest' || params.selector === 'latest') {
        targetWindowId = windowRegistry.getNewest()?.id;
      } else if (params.selector === 'oldest') {
        targetWindowId = windowRegistry.getOldest()?.id;
      } else if (params.selector === 'active') {
        const reg: any = windowRegistry as any;
        targetWindowId = reg.getActive ? reg.getActive()?.id : undefined;
      } else if (params.selector === 'all') {
        // Broadcast close for each known window
        const reg: any = windowRegistry as any;
        const all: Array<{ id: string }> = (reg.getAll ? reg.getAll() : []) || [];
        all.forEach(w => {
          const closeData = { windowId: w.id, timestamp: Date.now() };
          eventBus.emit('ui:close_window', closeData);
          eventBus.emit('window:closed', closeData);
          
          // Forward to worker if needed
          try {
            if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
              (self as any).postMessage({ type: 'UI_CLOSE_WINDOW', data: closeData });
            }
          } catch (_) {
            // no-op
          }
        });
        console.log(`[ToolExecutor] Closing all windows (${all.length})`);
        const result = {
          taskId: task.id,
          success: true,
          result: { closedAll: true, count: all.length },
          timestamp: Date.now()
        };
        eventBus.emit('ai:tool_call_completed', { task, tool: 'close_window', result });
        return result;
      }
    }

    // Validate parameters
    if (!targetWindowId) {
      throw new Error('No target window found to close');
    }

    // Emit event to UI for window closure
    const closeData = {
      windowId: targetWindowId,
      timestamp: Date.now()
    };

    // Emit to event bus for UI to handle
    eventBus.emit('ui:close_window', closeData);

    // Also emit a general window event
    eventBus.emit('window:closed', closeData);

    // If running inside a Web Worker, forward to the main thread
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_CLOSE_WINDOW', data: closeData });
      }
    } catch (_) {
      // no-op
    }

    console.log(`[ToolExecutor] Closing window:`, closeData);

    const result = {
      taskId: task.id,
      success: true,
      result: {
        windowId: targetWindowId,
        closed: true
      },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'close_window', result });
    return result;
  }


  private async executeWebSearch(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as WebSearchParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'web_search', params });

    try {
      // Validate parameters
      if (!params.query) {
        throw new Error('Missing required parameter: query');
      }

      const resultCount = params.resultCount || 5;
      const displayMode = params.displayMode || 'auto';

      // Build absolute URL in worker contexts
      let targetUrl = '/api/web-search';
      try {
        const isWorker = typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined';
        if (isWorker) {
          let origin = 'http://localhost:3000';
          try {
            if (typeof location !== 'undefined' && (location as any)?.origin) {
              origin = (location as any).origin;
            } else if (typeof location !== 'undefined' && (location as any)?.href) {
              origin = new URL((location as any).href).origin;
            }
          } catch {}
          targetUrl = `${origin}/api/web-search`;
        }
      } catch {}

      // Call server route to perform web search (Gemini or fallback)
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: params.query, resultCount })
      });
      if (!resp.ok) throw new Error(`Search HTTP ${resp.status}`);
      const data = await resp.json();
      const searchResults = Array.isArray(data?.results) ? data.results : [];
  console.log(`[ToolExecutor] Web search returned ${searchResults.length} results:`, searchResults);

      if (searchResults.length === 0) {
        throw new Error('No search results found');
      }

      // Determine display mode
      let finalDisplayMode = displayMode;
      if (displayMode === 'auto') {
        finalDisplayMode = searchResults.length === 1 ? 'summary' : 'links';
      }

      // Revert: do not auto-open the first result. Always show summary/links first.

      // Generate window content based on display mode
      let windowContent = '';
      let windowTitle = `Search: ${params.query}`;

      if (finalDisplayMode === 'summary' && searchResults[0]) {
        const result = searchResults[0];
        windowContent = `**${result.title}**\n\n${result.content || result.snippet}\n\n🔗 ${result.url}`;
      } else if (finalDisplayMode === 'full' && searchResults[0]) {
        const result = searchResults[0];
        windowContent = `# ${result.title}\n\n${result.content || result.snippet}\n\n---\n🔗 ${result.url}`;
      } else {
        // Links mode - multiple results
        windowContent = `**Search Results for "${params.query}"**

${searchResults.map((result: { title: string; url: string; snippet: string }, index: number) => 
  `${index + 1}. **${result.title}**
   ${result.snippet}\n   🔗 ${result.url}
`).join('\n\n')}

Found ${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`;
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

      console.log(`[ToolExecutor] Web search completed for: "${params.query}"`, windowData);

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
      
      // Open an error window so the user sees feedback
      try {
        const windowId = this.generateWindowId();
        const windowData = {
          id: windowId,
          type: 'search-results',
          title: `Search Error`,
          content: `Search failed for "${params.query}": ${errorMsg}`,
          position: { x: 180, y: 180 },
          size: { width: 540, height: 300 },
          context: { title: 'Search Error', content: errorMsg, type: 'search-results' },
          timestamp: Date.now()
        };
        eventBus.emit('ui:open_window', windowData);
        eventBus.emit('window:opened', windowData);
      } catch {}

      eventBus.emit('ai:tool_call_failed', { task, tool: 'web_search', error: errorMsg });
      
      return {
        taskId: task.id,
        success: false,
        error: errorMsg,
        timestamp: Date.now()
      };
    }
  }

  private async executeOpenWebView(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as { url: string; title?: string; width?: number; height?: number };
    eventBus.emit('ai:tool_call_started', { task, tool: 'open_webview', params });

    if (!params.url || typeof params.url !== 'string') {
      throw new Error('open_webview requires a valid url');
    }

    const windowId = this.generateWindowId();
    const windowData = {
      id: windowId,
      type: 'webview',
      title: params.title || params.url,
      content: '',
      position: { x: 160, y: 160 },
      size: { width: params.width || 900, height: params.height || 600 },
      context: {
        title: params.title || params.url,
        content: '',
        type: 'webview',
        metadata: { url: params.url }
      },
      timestamp: Date.now()
    };

    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);

    // Forward to worker if needed
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
      }
    } catch {}

    const result = {
      taskId: task.id,
      success: true,
      result: { windowId, url: params.url },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'open_webview', result });
    return result;
  }

  private async executeOpenSearchResult(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as { index?: number; url?: string; title?: string };
    eventBus.emit('ai:tool_call_started', { task, tool: 'open_search_result', params });

    const openUrl = params.url;
    if (openUrl && typeof openUrl === 'string') {
      return this.executeOpenWebView({
        ...task,
        tool: 'open_webview',
        parameters: { url: openUrl, title: params.title }
      });
    }

    // If no URL given, try to open the first recent search result from the last web_search call result summary
    // As a simple UX, we will look for the last window of type 'search-results' and open the Nth link via regex
    try {
      const reg: any = windowRegistry as any;
      const all = reg.getAll ? reg.getAll() : [];
      const lastSearch = [...all].reverse().find((w: any) => w?.type === 'search-results');
      if (!lastSearch) throw new Error('No recent search results found');

      const content: string = lastSearch?.meta?.content || '';
      const urls = Array.from(content.matchAll(/https?:\/\/[^\s\)]+/g)).map(m => m[0]);
      const idx = Math.max(1, params.index || 1) - 1;
      const url = urls[idx];
      if (!url) throw new Error('Requested result not found');

      return this.executeOpenWebView({
        ...task,
        tool: 'open_webview',
        parameters: { url, title: params.title }
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      eventBus.emit('ai:tool_call_failed', { task, tool: 'open_search_result', error: errorMsg });
      return { taskId: task.id, success: false, error: errorMsg, timestamp: Date.now() };
    }
  }


  private async executeCreateGroup(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as CreateGroupParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'create_group', params });

    try {
      if (!params.name || !params.color) {
        throw new Error('Missing required parameters: name and color');
      }

      // Emit event to create group
      eventBus.emit('window:create_group', {
        name: params.name,
        color: params.color
      });

      console.log(`[ToolExecutor] Created group "${params.name}" with color ${params.color}`);

      const result = {
        taskId: task.id,
        success: true,
        result: {
          groupName: params.name,
          groupColor: params.color
        },
        timestamp: Date.now()
      };

      eventBus.emit('ai:tool_call_completed', { task, tool: 'create_group', result });
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      eventBus.emit('ai:tool_call_failed', { task, tool: 'create_group', error: errorMsg });
      
      return {
        taskId: task.id,
        success: false,
        error: errorMsg,
        timestamp: Date.now()
      };
    }
  }

  private async executeAssignGroup(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as AssignGroupParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'assign_group', params });

    try {
      if (!params.groupName) {
        throw new Error('Missing required parameter: groupName');
      }

      let targetWindowId = params.windowId;
      if (!targetWindowId && params.selector) {
        if (params.selector === 'newest') {
          targetWindowId = windowRegistry.getNewest()?.id;
        } else if (params.selector === 'active') {
          const reg: any = windowRegistry as any;
          targetWindowId = reg.getActive ? reg.getActive()?.id : undefined;
        } else if (params.selector === 'all') {
          // Assign all windows to group
          const reg: any = windowRegistry as any;
          const all: Array<{ id: string }> = (reg.getAll ? reg.getAll() : []) || [];
          all.forEach(w => {
            eventBus.emit('window:assign_group', {
              windowId: w.id,
              groupName: params.groupName
            });
          });
          
          console.log(`[ToolExecutor] Assigned ${all.length} windows to group "${params.groupName}"`);
          
          const result = {
            taskId: task.id,
            success: true,
            result: { 
              groupName: params.groupName,
              assignedCount: all.length
            },
            timestamp: Date.now()
          };

          eventBus.emit('ai:tool_call_completed', { task, tool: 'assign_group', result });
          return result;
        }
      }

      // Default to newest if no selector
      if (!targetWindowId) {
        targetWindowId = windowRegistry.getNewest()?.id;
      }

      if (!targetWindowId) {
        throw new Error('No window found to assign to group');
      }

      // Emit event to assign window to group
      eventBus.emit('window:assign_group', {
        windowId: targetWindowId,
        groupName: params.groupName
      });

      console.log(`[ToolExecutor] Assigned window ${targetWindowId} to group "${params.groupName}"`);

      const result = {
        taskId: task.id,
        success: true,
        result: {
          windowId: targetWindowId,
          groupName: params.groupName
        },
        timestamp: Date.now()
      };

      eventBus.emit('ai:tool_call_completed', { task, tool: 'assign_group', result });
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      eventBus.emit('ai:tool_call_failed', { task, tool: 'assign_group', error: errorMsg });
      
      return {
        taskId: task.id,
        success: false,
        error: errorMsg,
        timestamp: Date.now()
      };
    }
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const toolExecutor = new ToolExecutor();
