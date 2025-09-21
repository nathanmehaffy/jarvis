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
        
        case 'organize_windows':
          result = await this.executeOrganizeWindows(task);
          break;

        case 'edit_window':
          result = await this.executeEditWindow(task, uiContext);
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

  private async executeOrganizeWindows(task: Task): Promise<ExecutionResult> {
    eventBus.emit('ai:tool_call_started', { task, tool: 'organize_windows', params: {} });
    
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
      const matchLower = String(params.titleMatch).toLowerCase();
      const found = windows.find(w => String(w.title || '').toLowerCase() === matchLower);
      targetWindowId = found?.id;
    }

    if (!targetWindowId && !params.titleMatch) {
      throw new Error('edit_window requires windowId or titleMatch');
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
      result: { updated: true, targetWindowId, viaTitle: !targetWindowId && !!params.titleMatch },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'edit_window', result });
    return result;
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const toolExecutor = new ToolExecutor();
