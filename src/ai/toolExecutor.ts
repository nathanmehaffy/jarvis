/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task, OpenWindowParams, CloseWindowParams, WebSearchParams, CreateGroupParams, AssignGroupParams, SummarizeArticleParams, EditWindowParams, AnalyzeImageParams, AnalyzePdfParams, CreateTaskParams, ViewTasksParams, SetReminderParams, WeatherParams, NewsParams, StocksParams } from './types';
import { eventBus } from '@/lib/eventBus';

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}

export class ToolExecutor {
<<<<<<< HEAD
  async executeTasks(tasks: Task[], uiContext?: any): Promise<ExecutionResult[]> {
=======
  // Note: all web search now routes through server API; no client Gemini usage
  constructor() {}
  async executeTasks(tasks: Task[]): Promise<ExecutionResult[]> {
>>>>>>> VarshyGemini
    eventBus.emit('ai:task_queue_updated', tasks);
    const results: ExecutionResult[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.executeTask(task, uiContext);
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

  private async executeTask(task: Task, uiContext?: any): Promise<ExecutionResult> {
    eventBus.emit('ai:task_started', { task });
    const startTime = Date.now();
    
    try {
      let result: ExecutionResult;
      switch (task.tool) {
        case 'open_window':
          result = await this.executeOpenWindow(task);
          break;
        
        case 'close_window':
          result = await this.executeCloseWindow(task, uiContext);
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
        case 'edit_window':
          result = await this.executeEditWindow(task);
          break;

        case 'open_search_result':
          result = await this.executeOpenSearchResult(task);
          break;
        case 'summarize_article':
          result = await this.executeSummarizeArticle(task);
          break;
        case 'analyze_image':
          result = await this.executeAnalyzeImage(task);
          break;
        case 'analyze_pdf':
          result = await this.executeAnalyzePdf(task);
          break;
        case 'create_task':
          result = await this.executeCreateTask(task);
          break;
        case 'view_tasks':
          result = await this.executeViewTasks(task);
          break;
        case 'set_reminder':
          result = await this.executeSetReminder(task);
          break;
        case 'get_weather':
          result = await this.executeGetWeather(task);
          break;
        case 'get_news':
          result = await this.executeGetNews(task);
          break;
        case 'get_stocks':
          result = await this.executeGetStocks(task);
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
    const params = task.parameters as unknown as OpenWindowParams;
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
      position: params.context.position || { x: 0, y: 0 },
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

  private async executeCloseWindow(task: Task, uiContext?: any): Promise<ExecutionResult> {
    const params = task.parameters as unknown as CloseWindowParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'close_window', params });

    // Resolve selector to actual window ID if needed
    let targetWindowId = params.windowId;
    if (!targetWindowId && params.selector) {
      const windows: Array<{ id: string; createdAt?: number; zIndex?: number; isMinimized?: boolean }>
        = Array.isArray(uiContext?.windows) ? uiContext.windows : [];
      if (params.selector === 'newest' || params.selector === 'latest') {
        targetWindowId = (windows.slice().sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0] || {}).id;
      } else if (params.selector === 'oldest') {
        targetWindowId = (windows.slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))[0] || {}).id;
      } else if (params.selector === 'active') {
        targetWindowId = (windows.slice().sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0] || {}).id;
      } else if (params.selector === 'all') {
        const ids = windows.map(w => w.id);
        ids.forEach(id => {
          const closeData = { windowId: id, timestamp: Date.now() };
          eventBus.emit('ui:close_window', closeData);
          eventBus.emit('window:closed', closeData);
          try {
            if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
              (self as any).postMessage({ type: 'UI_CLOSE_WINDOW', data: closeData });
            }
          } catch (_) {}
        });
        const result = {
          taskId: task.id,
          success: true,
          result: { closedAll: true, count: ids.length },
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

  private async executeSummarizeArticle(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as SummarizeArticleParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'summarize_article', params });

    if (!params.url) throw new Error('summarize_article requires url');

    // Fetch reader content from server
    const resp = await fetch('/api/fetch-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: params.url })
    });
    if (!resp.ok) throw new Error(`Reader HTTP ${resp.status}`);
    const article = await resp.json();

    const maxBullets = Math.max(3, Math.min(20, params.maxBullets || 8));

    // Simple summarization heuristic (client-side) if Gemini not desired here: first N sentences
    const sentences = String(article.textContent || '').split(/(?<=[.!?])\s+/).filter(Boolean);
    const bullets = sentences.slice(0, maxBullets).map(s => `- ${s}`);

    const content = `Summary of: ${article.title || params.url}\n\n${bullets.join('\n')}\n\nSource: ${params.url}`;

    const windowId = this.generateWindowId();
    const windowData = {
      id: windowId,
      type: 'notes',
      title: article.title ? `${article.title} — Notes` : 'Article Notes',
      content,
      position: { x: 180, y: 180 },
      size: { width: 500, height: 400 },
      context: { title: article.title || 'Notes', content, type: 'notes' },
      timestamp: Date.now()
    };
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);

    const result = { taskId: task.id, success: true, result: { windowId, url: params.url }, timestamp: Date.now() };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'summarize_article', result });
    return result;
  }

  private async executeAnalyzeImage(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as AnalyzeImageParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'analyze_image', params });
    try {
      const resp = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!resp.ok) throw new Error(`Image HTTP ${resp.status}`);
      const data = await resp.json();
      const windowId = this.generateWindowId();
      const content = String(data?.result || 'No result');
      const windowData = {
        id: windowId,
        type: 'analysis',
        title: params.prompt ? `Image Analysis — ${params.prompt}` : 'Image Analysis',
        content,
        position: { x: 220, y: 180 },
        size: { width: 520, height: 380 },
        context: { title: 'Image Analysis', content, type: 'analysis' },
        timestamp: Date.now()
      };
      eventBus.emit('ui:open_window', windowData);
      eventBus.emit('window:opened', windowData);
      const result = { taskId: task.id, success: true, result: { windowId, analysis: content }, timestamp: Date.now() };
      eventBus.emit('ai:tool_call_completed', { task, tool: 'analyze_image', result });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      eventBus.emit('ai:tool_call_failed', { task, tool: 'analyze_image', error: msg });
      return { taskId: task.id, success: false, error: msg, timestamp: Date.now() };
    }
  }

  private async executeAnalyzePdf(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as AnalyzePdfParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'analyze_pdf', params });
    try {
      const resp = await fetch('/api/analyze-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!resp.ok) throw new Error(`PDF HTTP ${resp.status}`);
      const data = await resp.json();
      const windowId = this.generateWindowId();
      const content = String(data?.summary || 'No summary');
      const windowData = {
        id: windowId,
        type: 'analysis',
        title: 'PDF Summary',
        content,
        position: { x: 240, y: 200 },
        size: { width: 560, height: 420 },
        context: { title: 'PDF Summary', content, type: 'analysis' },
        timestamp: Date.now()
      };
      eventBus.emit('ui:open_window', windowData);
      eventBus.emit('window:opened', windowData);
      const result = { taskId: task.id, success: true, result: { windowId, summary: content }, timestamp: Date.now() };
      eventBus.emit('ai:tool_call_completed', { task, tool: 'analyze_pdf', result });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      eventBus.emit('ai:tool_call_failed', { task, tool: 'analyze_pdf', error: msg });
      return { taskId: task.id, success: false, error: msg, timestamp: Date.now() };
    }
  }

  private async executeCreateTask(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as CreateTaskParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'create_task', params });
    if (!params.title) throw new Error('create_task requires title');
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    eventBus.emit('tasks:create', { id, title: params.title, due: params.due || null, notes: params.notes || '' });
    // Open/refresh a task list window
    const windowId = this.generateWindowId();
    const windowData = { id: windowId, type: 'tasks', title: 'Tasks', content: `Added: ${params.title}${params.due ? ` (due ${params.due})` : ''}`, position: { x: 260, y: 220 }, size: { width: 480, height: 360 }, context: { title: 'Tasks', content: '', type: 'tasks' }, timestamp: Date.now() };
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);
    const result = { taskId: task.id, success: true, result: { id }, timestamp: Date.now() };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'create_task', result });
    return result;
  }

  private async executeViewTasks(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as ViewTasksParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'view_tasks', params });
    // Ask UI to open a tasks window; UI will load from localStorage
    const windowId = this.generateWindowId();
    const windowData = { id: windowId, type: 'tasks', title: 'Tasks', content: '', position: { x: 280, y: 240 }, size: { width: 520, height: 380 }, context: { title: 'Tasks', content: '', type: 'tasks', metadata: { filter: params.filter || 'all' } }, timestamp: Date.now() };
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);
    const result = { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'view_tasks', result });
    return result;
  }

  private async executeSetReminder(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as SetReminderParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'set_reminder', params });
    if (!params.message || !params.time) throw new Error('set_reminder requires message and time');
    // Client-side scheduling (in this process) using setTimeout; parse simple phrases
    const parseDelay = (t: string): number | null => {
      const m = t.match(/in\s+(\d+)\s*(second|sec|minute|min|hour|hr)s?/i);
      if (m) {
        const n = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        if (unit.startsWith('sec')) return n * 1000;
        if (unit.startsWith('min')) return n * 60_000;
        if (unit.startsWith('h')) return n * 60 * 60_000;
      }
      const asDate = Date.parse(t);
      if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
      return null;
    };
    const delay = parseDelay(params.time);
    if (delay == null) throw new Error('Could not parse reminder time');
    setTimeout(() => {
      try {
        const windowId = this.generateWindowId();
        const windowData = { id: windowId, type: 'notification', title: 'Reminder', content: params.message, position: { x: 320, y: 260 }, size: { width: 360, height: 200 }, context: { title: 'Reminder', content: params.message, type: 'notification' }, timestamp: Date.now() };
        eventBus.emit('ui:open_window', windowData);
        eventBus.emit('window:opened', windowData);
      } catch {}
    }, delay);
    const result = { taskId: task.id, success: true, result: { scheduledInMs: delay }, timestamp: Date.now() };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'set_reminder', result });
    return result;
  }

  private async executeGetWeather(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as WeatherParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'get_weather', params });
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/api/gemini-data`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ type: 'weather', location: params.location }) 
    });
    if (!resp.ok) throw new Error(`Weather HTTP ${resp.status}`);
    
    const data = await resp.json();
    const windowId = this.generateWindowId();
    
    let content = '';
    if (data?.data?.current) {
      const w = data.data;
      content = `🌤️ Weather for ${w.location}

Current: ${w.current.temperature}°C, ${w.current.condition}
${w.current.description}

Today: ${w.today.high}°C / ${w.today.low}°C
${w.today.forecast}

💨 Wind: ${w.current.windSpeed} km/h
💧 Humidity: ${w.current.humidity}%`;
    } else {
      content = data?.data?.rawResponse || 'Weather data unavailable';
    }
    
    const windowData = { 
      id: windowId, 
      type: 'weather', 
      title: `Weather: ${params.location}`, 
      content, 
      position: { x: 180, y: 200 }, 
      size: { width: 420, height: 260 }, 
      context: { title: `Weather: ${params.location}`, content, type: 'weather' }, 
      timestamp: Date.now() 
    };
    
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);
    return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
  }

  private async executeGetNews(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as NewsParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'get_news', params });
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/api/gemini-data`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ type: 'news', query: params.query }) 
    });
    if (!resp.ok) throw new Error(`News HTTP ${resp.status}`);
    
    const data = await resp.json();
    const windowId = this.generateWindowId();
    
    let content = '';
    if (data?.data?.articles && Array.isArray(data.data.articles)) {
      const arts = data.data.articles.slice(0, params.pageSize || 5);
      const lines = arts.map((a: any, i: number) => 
        `📰 ${i + 1}. ${a.title}
📅 ${a.publishedAt} | 📺 ${a.source}
📝 ${a.summary}
🔗 ${a.url}`
      ).join('\n\n');
      content = `📰 News about "${params.query}"\n\n${lines}`;
    } else {
      content = data?.data?.rawResponse || 'No news articles found';
    }
    
    const windowData = { 
      id: windowId, 
      type: 'news', 
      title: `News: ${params.query}`, 
      content, 
      position: { x: 200, y: 220 }, 
      size: { width: 560, height: 420 }, 
      context: { title: `News: ${params.query}`, content, type: 'news' }, 
      timestamp: Date.now() 
    };
    
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);
    return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
  }

  private async executeGetStocks(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as StocksParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'get_stocks', params });
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/api/gemini-data`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ type: 'stocks', symbol: params.symbol }) 
    });
    if (!resp.ok) throw new Error(`Stocks HTTP ${resp.status}`);
    
    const data = await resp.json();
    const windowId = this.generateWindowId();
    
    let content = '';
    if (data?.data?.price !== undefined) {
      const s = data.data;
      const changeIcon = s.change >= 0 ? '📈' : '📉';
      const changeColor = s.change >= 0 ? '+' : '';
      content = `💰 ${s.symbol} Stock Info

Current Price: $${s.price}
${changeIcon} Change: ${changeColor}${s.change} (${s.changePercent}%)

📊 Day Range: $${s.dayLow} - $${s.dayHigh}
🏢 Market Cap: ${s.marketCap}

${s.analysis ? `📝 Analysis:\n${s.analysis}` : ''}`;
    } else {
      content = data?.data?.rawResponse || 'Stock data unavailable';
    }
    
    const windowData = { 
      id: windowId, 
      type: 'stocks', 
      title: `Stock: ${params.symbol}`, 
      content, 
      position: { x: 220, y: 240 }, 
      size: { width: 520, height: 360 }, 
      context: { title: `Stock: ${params.symbol}`, content, type: 'stocks' }, 
      timestamp: Date.now() 
    };
    
    eventBus.emit('ui:open_window', windowData);
    eventBus.emit('window:opened', windowData);
    return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
  }

  private async executeOpenSearchResult(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as { index?: number; url?: string; title?: string };
    eventBus.emit('ai:tool_call_started', { task, tool: 'open_search_result', params });

    const decodeDdg = (u: string) => {
      const m = u.match(/uddg=([^&]+)/);
      if (m) {
        try { return decodeURIComponent(m[1]); } catch {}
      }
      return u;
    };

    const openUrl = params.url ? decodeDdg(params.url) : undefined;
    if (openUrl && typeof openUrl === 'string') {
      return this.executeOpenWebView({
        ...task,
        tool: 'open_webview',
        parameters: { url: openUrl, title: params.title }
      });
    }

    // If no URL given, try to open from the last search-results window's stored metadata first,
    // falling back to parsing links from content if needed.
    try {
      const reg: any = windowRegistry as any;
      const all = reg.getAll ? reg.getAll() : [];
      const lastSearch = [...all].reverse().find((w: any) => w?.type === 'search-results');
      if (!lastSearch) throw new Error('No recent search results found');

      const idx = Math.max(1, params.index || 1) - 1;
      // Prefer structured results stored in window context metadata
      const structured: any[] = lastSearch?.meta?.context?.metadata?.results || [];
      let url: string | undefined;
      if (Array.isArray(structured) && structured[idx] && typeof structured[idx].url === 'string') {
        url = decodeDdg(structured[idx].url);
      }
      // Fallback: parse from rendered content
      if (!url) {
        const content: string = (lastSearch?.content || (lastSearch?.meta?.content || '')) as string;
        const urls = Array.from(content.matchAll(/https?:\/\/[^\s\)]+/g)).map(m => decodeDdg(m[0]));
        url = urls[idx];
      }
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

  private async executeEditWindow(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as EditWindowParams;
    eventBus.emit('ai:tool_call_started', { task, tool: 'edit_window', params });

    let targetWindowId = params.windowId;
    if (!targetWindowId && params.selector) {
      if (params.selector === 'newest') targetWindowId = windowRegistry.getNewest()?.id;
      else if (params.selector === 'active') {
        const reg: any = windowRegistry as any;
        targetWindowId = reg.getActive ? reg.getActive()?.id : undefined;
      } else if (params.selector === 'oldest') targetWindowId = windowRegistry.getOldest()?.id;
    }
    if (!targetWindowId) throw new Error('No window found to edit');

    const mode = params.mode || 'set';
    eventBus.emit('ui:update_window', {
      windowId: targetWindowId,
      title: typeof params.title === 'string' ? params.title : undefined,
      contentUpdate: typeof params.content === 'string' || mode === 'clear' ? { mode, text: params.content || '' } : undefined
    });

    const result = { taskId: task.id, success: true, result: { windowId: targetWindowId }, timestamp: Date.now() };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'edit_window', result });
    return result;
  }
}

export const toolExecutor = new ToolExecutor();
