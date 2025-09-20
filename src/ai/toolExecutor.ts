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
    
    // Validate parameters
    if (!params.windowId) {
      throw new Error('Missing required parameter for close_window: windowId is required');
    }
    
    // Emit event to UI for window closure
    const closeData = {
      windowId: params.windowId,
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
        windowId: params.windowId,
        closed: true
      },
      timestamp: Date.now()
    };
    eventBus.emit('ai:tool_call_completed', { task, tool: 'close_window', result });
    return result;
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const toolExecutor = new ToolExecutor();
