/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task, OpenWindowParams, CloseWindowParams } from './types';
import { eventBus } from '@/lib/eventBus';

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}

export class ToolExecutor {
  async executeTasks(tasks: Task[], uiContext?: any): Promise<ExecutionResult[]> {
    console.log('🚀 [ToolExecutor] executeTasks STARTED', {
      taskCount: tasks.length,
      tasks: tasks,
      uiContext: uiContext,
      timestamp: new Date().toISOString()
    });

    eventBus.emit('ai:task_queue_updated', tasks);
    const results: ExecutionResult[] = [];

    for (const task of tasks) {
      console.log('🔧 [ToolExecutor] Processing individual task', {
        taskId: task.id,
        tool: task.tool,
        parameters: task.parameters,
        timestamp: new Date().toISOString()
      });

      try {
        const result = await this.executeTask(task, uiContext);
        console.log('✅ [ToolExecutor] Task executed successfully', {
          taskId: task.id,
          result: result,
          timestamp: new Date().toISOString()
        });
        results.push(result);
      } catch (error) {
        const errorResult = {
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        };
        console.error('❌ [ToolExecutor] Task execution failed', {
          taskId: task.id,
          error: errorResult.error,
          task: task,
          timestamp: new Date().toISOString()
        });
        results.push(errorResult);
        eventBus.emit('ai:task_failed', { task, error: errorResult.error });
      }
    }

    console.log('🏁 [ToolExecutor] executeTasks COMPLETED', {
      totalTasks: tasks.length,
      successfulTasks: results.filter(r => r.success).length,
      failedTasks: results.filter(r => !r.success).length,
      results: results,
      timestamp: new Date().toISOString()
    });

    return results;
  }

  private async executeTask(task: Task, uiContext?: any): Promise<ExecutionResult> {
    console.log('🔭 [ToolExecutor] executeTask STARTED', {
      taskId: task.id,
      tool: task.tool,
      parameters: task.parameters,
      uiContext: uiContext,
      timestamp: new Date().toISOString()
    });

    eventBus.emit('ai:task_started', { task });
    const startTime = Date.now();

    try {
      let result: ExecutionResult;
      switch (task.tool) {
        case 'open_window':
          console.log('🦾 [ToolExecutor] Executing open_window tool');
          result = await this.executeOpenWindow(task);
          break;

        case 'close_window':
          console.log('❌ [ToolExecutor] Executing close_window tool');
          result = await this.executeCloseWindow(task, uiContext);
          break;

        case 'search':
          console.log('🔍 [ToolExecutor] Executing search tool');
          result = await this.executeSearch(task);
          break;

        case 'organize_windows':
          result = await this.executeOrganizeWindows(task);
          break;

        case 'edit_window':
          result = await this.executeEditWindow(task, uiContext);
          break;
        case 'show_integral_visual':
          result = await this.executeShowIntegralVisual(task);
          break;
        case 'start_adaptive_quiz':
          result = await this.executeStartAdaptiveQuiz(task);
          break;
        default:
          console.error('⚠️ [ToolExecutor] Unknown tool requested', { tool: task.tool });
          throw new Error(`Unknown tool: ${task.tool}`);
      }

      console.log('✅ [ToolExecutor] executeTask COMPLETED successfully', {
        taskId: task.id,
        executionTime: `${Date.now() - startTime}ms`,
        result: result,
        timestamp: new Date().toISOString()
      });

      eventBus.emit('ai:task_completed', { task, result });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ [ToolExecutor] executeTask FAILED', {
        taskId: task.id,
        tool: task.tool,
        error: errorMsg,
        executionTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });

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
    console.log('🦾 [ToolExecutor] executeOpenWindow STARTED', {
      taskId: task.id,
      params: params,
      timestamp: new Date().toISOString()
    });

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
    
    console.log('🎨 [ToolExecutor] Window creation data prepared', {
      windowId: windowId,
      windowType: params.windowType,
      windowData: windowData,
      eventBusEmissions: ['ui:open_window', 'window:opened'],
      timestamp: new Date().toISOString()
    });
    
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

    console.log('✅ [ToolExecutor] executeOpenWindow COMPLETED', {
      taskId: task.id,
      result: result,
      timestamp: new Date().toISOString()
    });

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

  private async executeSearch(task: Task): Promise<ExecutionResult> {
    console.log('🔍 [ToolExecutor] executeSearch STARTED', {
      taskId: task.id,
      parameters: task.parameters,
      timestamp: new Date().toISOString()
    });

    eventBus.emit('ai:tool_call_started', { task, tool: 'search' });

    const query = task.parameters?.query;
    if (!query || typeof query !== 'string') {
      const error = 'Missing or invalid query parameter for search tool';
      console.error('❌ [ToolExecutor] Search validation failed', {
        taskId: task.id,
        parameters: task.parameters,
        error: error,
        timestamp: new Date().toISOString()
      });
      throw new Error(error);
    }

    console.log('🔎 [ToolExecutor] Search query validated', {
      taskId: task.id,
      query: query,
      timestamp: new Date().toISOString()
    });

    // Emit searching event
    eventBus.emit('ai:searching', { query });

    try {
      console.log('🔗 [ToolExecutor] Importing Gemini client');
      // Dynamically import Gemini client to avoid bundling server-only modules
      const { geminiClient } = await import('./geminiClient');

      console.log('🤖 [ToolExecutor] Calling Gemini API for search', {
        query: query,
        timestamp: new Date().toISOString()
      });
      const searchStart = Date.now();

      // Call Gemini API
      const searchResults = await geminiClient.generateResponse(query);

      const searchEnd = Date.now();
      console.log('📝 [ToolExecutor] Gemini API response received', {
        query: query,
        responseTime: `${searchEnd - searchStart}ms`,
        results: searchResults,
        resultsLength: typeof searchResults === 'string' ? searchResults.length : 'not-string',
        timestamp: new Date().toISOString()
      });

      // Generate unique window ID
      const windowId = this.generateWindowId();
      console.log('🆔 [ToolExecutor] Generated window ID for search results', {
        windowId: windowId,
        query: query,
        timestamp: new Date().toISOString()
      });

      // Emit window opening event with search results
      const windowData = {
        id: windowId,
        type: 'search-results',
        title: `Search Results: ${query}`,
        content: searchResults,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        timestamp: Date.now()
      };

      console.log('🎨 [ToolExecutor] Search results window data prepared', {
        windowData: windowData,
        eventsToEmit: ['ui:open_window', 'window:opened'],
        timestamp: new Date().toISOString()
      });

      eventBus.emit('ui:open_window', windowData);
      console.log('📢 [ToolExecutor] Emitted ui:open_window event', { windowData });

      // Bridge to main thread - THIS IS THE KEY FIX!
      try {
        if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
          (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
          console.log('🌉 [ToolExecutor] Posted UI_OPEN_WINDOW message to main thread', { windowData });
        }
      } catch (error) {
        console.error('❌ [ToolExecutor] Failed to post message to main thread', { error });
      }

      // Also emit a general window event
      eventBus.emit('window:opened', windowData);
      console.log('📢 [ToolExecutor] Emitted window:opened event', { windowData });

      // Emit search completion event
      eventBus.emit('ai:search_complete', {
        success: true,
        results: searchResults,
        query
      });
      console.log('📢 [ToolExecutor] Emitted ai:search_complete event', {
        success: true,
        query: query,
        timestamp: new Date().toISOString()
      });

      console.log('✅ [ToolExecutor] Search completed successfully', {
        query: query,
        windowId: windowId,
        timestamp: new Date().toISOString()
      });

      const result = {
        taskId: task.id,
        success: true,
        result: {
          windowId: windowId,
          query: query,
          results: searchResults
        },
        timestamp: Date.now()
      };

      console.log('🏆 [ToolExecutor] executeSearch COMPLETED successfully', {
        taskId: task.id,
        result: result,
        timestamp: new Date().toISOString()
      });

      eventBus.emit('ai:tool_call_completed', { task, tool: 'search', result });
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error('❌ [ToolExecutor] Search execution failed', {
        taskId: task.id,
        query: query,
        error: errorMsg,
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });

      // Emit search completion with failure
      eventBus.emit('ai:search_complete', {
        success: false,
        query,
        error: errorMsg
      });
      console.log('📢 [ToolExecutor] Emitted ai:search_complete event (failure)', {
        success: false,
        query: query,
        error: errorMsg,
        timestamp: new Date().toISOString()
      });

      // Emit error event
      eventBus.emit('ai:error', { message: `Search failed: ${errorMsg}` });
      console.log('📢 [ToolExecutor] Emitted ai:error event', {
        message: `Search failed: ${errorMsg}`,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Search execution failed: ${errorMsg}`);
    }
  }

  private async executeOrganizeWindows(task: Task): Promise<ExecutionResult> {
    eventBus.emit('ai:tool_call_started', { task, tool: 'organize_windows', params: task.parameters });

    // Emit organize event to the UI
    eventBus.emit('ui:organize_windows');

    // If running inside a Web Worker, forward to the main thread
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_ORGANIZE_WINDOWS', data: {} });
      }
    } catch (_) {
      // no-op
    }

    console.log(`[ToolExecutor] Organizing windows`);

    const result = {
      taskId: task.id,
      success: true,
      result: {
        action: 'organize_windows',
        message: 'Windows organized successfully'
      },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'organize_windows', result });
    return result;
  }

  private async executeEditWindow(task: Task, uiContext?: any): Promise<ExecutionResult> {
    const params = task.parameters as any; // EditWindowParams-like
    eventBus.emit('ai:tool_call_started', { task, tool: 'edit_window', params });

    // Resolve target by id or title match
    let targetWindowId = params.windowId as string | undefined;
    if (!targetWindowId && params.titleMatch) {
      const windows: Array<{ id: string; title: string }>
        = Array.isArray(uiContext?.windows) ? uiContext.windows : [];
      const normalize = (s: string) => s.trim().toLowerCase().replace(/^['"]|['"]$/g, '');
      const stripWindowPrefix = (s: string) => s.startsWith('window ') ? s.slice('window '.length) : s;
      const target = stripWindowPrefix(normalize(String(params.titleMatch)));
      const found = windows.find(w => {
        const wt = stripWindowPrefix(normalize(String(w.title || '')));
        return wt === target || wt.includes(target) || target.includes(wt);
      });
      targetWindowId = found?.id;
    }

    // If neither provided, default to active window from uiContext
    if (!targetWindowId && !params.titleMatch) {
      const activeId = typeof uiContext?.activeWindowId === 'string' ? uiContext.activeWindowId : undefined;
      if (activeId) {
        targetWindowId = activeId;
      }
    }

    if (!targetWindowId && !params.titleMatch) {
      throw new Error('No target window found to edit');
    }

    // Emit UI update
    const updateData = {
      windowId: targetWindowId,
      titleMatch: !targetWindowId ? String(params.titleMatch || '') : undefined,
      newTitle: typeof params.newTitle === 'string' ? params.newTitle : undefined,
      newContent: typeof params.newContent === 'string' ? params.newContent : undefined,
      timestamp: Date.now()
    };

    eventBus.emit('ui:update_window', updateData);

    // Worker forward if needed
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_UPDATE_WINDOW', data: updateData });
      }
    } catch (_) {}

    const result = {
      taskId: task.id,
      success: true,
      result: { updated: true, targetWindowId: targetWindowId || null, viaTitle: !targetWindowId && !!params.titleMatch },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'edit_window', result });
    return result;
  }

  private async executeShowIntegralVisual(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as any;
    eventBus.emit('ai:tool_call_started', { task, tool: 'show_integral_visual', params });

    const windowId = this.generateWindowId();
    const windowData = {
      id: windowId,
      type: 'math-visual',
      title: params?.title || `Visual: ∫ ${String(params?.expression || '')} d${String(params?.variable || 'x')}`,
      position: { x: 120, y: 120 },
      size: { width: 860, height: 600 },
      expression: params?.expression,
      variable: params?.variable ?? 'x',
      lower: params?.lower,
      upper: params?.upper,
      samples: params?.samples ?? 200,
      timestamp: Date.now()
    } as any;

    eventBus.emit('ui:open_window', windowData);
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
      }
    } catch (_) {}

    const result = {
      taskId: task.id,
      success: true,
      result: { windowId, type: 'math-visual' },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'show_integral_visual', result });
    return result;
  }

  private async executeStartAdaptiveQuiz(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as any;
    eventBus.emit('ai:tool_call_started', { task, tool: 'start_adaptive_quiz', params });

    const windowId = this.generateWindowId();
    const windowData = {
      id: windowId,
      type: 'adaptive-quiz',
      title: `Adaptive Quiz: ${String(params?.topic || 'addition')}`,
      topic: String(params?.topic || 'addition'),
      position: { x: 140, y: 140 },
      size: { width: 700, height: 480 },
      timestamp: Date.now()
    } as any;

    eventBus.emit('ui:open_window', windowData);
    try {
      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof (globalThis as any).window === 'undefined') {
        (self as any).postMessage({ type: 'UI_OPEN_WINDOW', data: windowData });
      }
    } catch (_) {}

    const result = {
      taskId: task.id,
      success: true,
      result: { windowId, type: 'adaptive-quiz' },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'start_adaptive_quiz', result });
    return result;
  }


  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const toolExecutor = new ToolExecutor();
