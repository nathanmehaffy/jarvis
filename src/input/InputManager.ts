/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/lib/eventBus';

export class InputManager {
  private worker: Worker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = new Worker(new URL('./inputWorker.ts', import.meta.url));
      
      this.worker.onmessage = (event) => {
        const { type, data } = event.data;
        eventBus.emit(`input:${type.toLowerCase()}`, data);
      };

      this.worker.onerror = (error) => {
        console.error('Input worker error:', error);
        eventBus.emit('input:error', error);
      };

      this.isInitialized = true;
      eventBus.emit('input:initialized');
    } catch (error) {
      console.error('Failed to initialize input worker:', error);
      eventBus.emit('input:error', error);
    }
  }

  processInput(input: any): void {
    if (!this.worker) {
      console.warn('Input worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'PROCESS_INPUT',
      data: input
    });
  }

  validateInput(input: any): void {
    if (!this.worker) {
      console.warn('Input worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'VALIDATE_INPUT',
      data: input
    });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    eventBus.emit('input:destroyed');
  }
}

export const inputManager = new InputManager();