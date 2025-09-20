import { eventBus } from '@/lib/eventBus';
import type { Task } from './types';

export class AIManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private uiContext: any = {};

  // Only send data that can be structured-cloned to the worker
  private getSerializableUIContext(): any {
    try {
      const context = this.uiContext || {};
      const serializable: any = {};

      if (Array.isArray(context.windows)) {
        serializable.windows = context.windows.map((w: any) => ({
          id: w?.id,
          title: w?.title,
          // omit component/functions; include only plain data
          isOpen: Boolean(w?.isOpen),
          isMinimized: Boolean(w?.isMinimized),
          x: typeof w?.x === 'number' ? w.x : undefined,
          y: typeof w?.y === 'number' ? w.y : undefined,
          width: typeof w?.width === 'number' ? w.width : undefined,
          height: typeof w?.height === 'number' ? w.height : undefined,
          zIndex: typeof w?.zIndex === 'number' ? w.zIndex : undefined
        }));
      }

      return serializable;
    } catch {
      return {};
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = new Worker(new URL('./aiWorker.ts', import.meta.url));
      
      this.worker.onmessage = (event) => {
        const { type, data } = event.data;
        // Normalize error channel
        if (type === 'AI_ERROR') {
          eventBus.emit('ai:error', data);
          return;
        }
        // Bridge UI_* messages to UI event bus
        if (type === 'UI_OPEN_WINDOW') {
          eventBus.emit('ui:open_window', data);
          return;
        }
        if (type === 'UI_CLOSE_WINDOW') {
          eventBus.emit('ui:close_window', data);
          return;
        }
        eventBus.emit(`ai:${type.toLowerCase()}`, data);
      };

      this.worker.onerror = (error) => {
        console.error('AI worker error:', error);
        eventBus.emit('ai:error', error);
      };

      this.isInitialized = true;
      eventBus.emit('ai:initialized');

      // Bridge: when input emits parsed task strings, forward each to worker for parsing & execution
      eventBus.on('input:tasks', (data: { tasks: Array<{ id: string; text: string }> }) => {
        try {
          const items = Array.isArray(data?.tasks) ? data.tasks : [];
          if (items.length === 0) return;
          eventBus.emit('ai:processing', { count: items.length });
          for (const item of items) {
            const text = item?.text ?? '';
            if (typeof text === 'string' && text.trim().length > 0) {
              this.worker?.postMessage({
                type: 'PROCESS_TEXT_COMMAND',
                data: { text, uiContext: this.getSerializableUIContext() }
              });
            }
          }
        } catch (e) {
          eventBus.emit('ai:error', e);
        }
      });
    } catch (error) {
      console.error('Failed to initialize AI worker:', error);
      eventBus.emit('ai:error', error);
    }
  }

  setUIContext(context: any): void {
    this.uiContext = context;
  }

  processRequest(request: any): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'PROCESS_AI_REQUEST',
      data: { ...request, uiContext: this.getSerializableUIContext() }
    });
  }

  processTextCommand(text: string): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'PROCESS_TEXT_COMMAND',
      data: { text, uiContext: this.getSerializableUIContext() }
    });
  }

  generateResponse(prompt: any): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'GENERATE_RESPONSE',
      data: prompt
    });
  }

  analyzeData(data: any): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'ANALYZE_DATA',
      data: data
    });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    eventBus.emit('ai:destroyed');
  }
}

export const aiManager = new AIManager();