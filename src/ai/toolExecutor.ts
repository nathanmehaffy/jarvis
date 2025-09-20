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
    const results: ExecutionResult[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);
      } catch (error) {
        results.push({
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }
    }
    
    return results;
  }

  private async executeTask(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      switch (task.tool) {
        case 'open_window':
          return await this.executeOpenWindow(task);
        
        case 'close_window':
          return await this.executeCloseWindow(task);
        
        default:
          throw new Error(`Unknown tool: ${task.tool}`);
      }
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now() - startTime
      };
    }
  }

  private async executeOpenWindow(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as OpenWindowParams;
    
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
    
    console.log(`[ToolExecutor] Opening ${params.windowType} window:`, windowData);
    
    return {
      taskId: task.id,
      success: true,
      result: {
        windowId: windowId,
        windowType: params.windowType,
        context: params.context
      },
      timestamp: Date.now()
    };
  }

  private async executeCloseWindow(task: Task): Promise<ExecutionResult> {
    const params = task.parameters as CloseWindowParams;
    
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
    
    console.log(`[ToolExecutor] Closing window:`, closeData);
    
    return {
      taskId: task.id,
      success: true,
      result: {
        windowId: params.windowId,
        closed: true
      },
      timestamp: Date.now()
    };
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const toolExecutor = new ToolExecutor();
