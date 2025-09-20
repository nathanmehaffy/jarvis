import { eventBus } from '@/lib/eventBus';
import type { Task } from './types';

export class AIManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private uiContext: any = {};

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = new Worker(new URL('./aiWorker.ts', import.meta.url));
      
      this.worker.onmessage = (event) => {
        const { type, data } = event.data;
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

      // Bridge: when input emits parsed tasks, forward to AI worker as a text command-like batch
      eventBus.on('input:tasks', (data: { tasks: Array<{ id: string; text: string }> }) => {
        try {
          const taskList = data?.tasks || [];
          eventBus.emit('ai:processing', { count: taskList.length });
          taskList.forEach((t) => {
            this.worker?.postMessage({
              type: 'PROCESS_TEXT_COMMAND',
              data: { text: t.text, uiContext: this.uiContext }
            });
          });
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
      data: { ...request, uiContext: this.uiContext }
    });
  }

  processTextCommand(text: string): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'PROCESS_TEXT_COMMAND',
      data: { text, uiContext: this.uiContext }
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