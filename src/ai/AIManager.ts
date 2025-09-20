/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/lib/eventBus';

export class AIManager {
  private worker: Worker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = new Worker(new URL('./aiWorker.ts', import.meta.url));
      
      this.worker.onmessage = (event) => {
        const { type, data } = event.data;
        eventBus.emit(`ai:${type.toLowerCase()}`, data);
      };

      this.worker.onerror = (error) => {
        console.error('AI worker error:', error);
        eventBus.emit('ai:error', error);
      };

      this.isInitialized = true;
      eventBus.emit('ai:initialized');
    } catch (error) {
      console.error('Failed to initialize AI worker:', error);
      eventBus.emit('ai:error', error);
    }
  }

  processRequest(request: any): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'PROCESS_AI_REQUEST',
      data: request
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