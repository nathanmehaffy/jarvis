import { eventBus } from '@/lib/eventBus';

type SerializableWindow = {
  id: string;
  title?: string;
  isOpen?: boolean;
  isMinimized?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
};

type SerializableUIContext = { windows?: SerializableWindow[] };

export class AIManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private uiContext: SerializableUIContext = {};

  // Only send data that can be structured-cloned to the worker
  private getSerializableUIContext(): SerializableUIContext & { activeWindowId?: string } {
    try {
      const context = this.uiContext || {};
      const serializable: SerializableUIContext & { activeWindowId?: string } = {};

      if (Array.isArray(context.windows)) {
        const cleaned: SerializableWindow[] = context.windows
          .filter((w: Partial<SerializableWindow>): w is SerializableWindow => typeof w?.id === 'string')
          .map((w) => ({
            id: w.id,
            title: w.title,
            // omit component/functions; include only plain data
            isOpen: Boolean(w.isOpen),
            isMinimized: Boolean(w.isMinimized),
            x: typeof w.x === 'number' ? w.x : undefined,
            y: typeof w.y === 'number' ? w.y : undefined,
            width: typeof w.width === 'number' ? w.width : undefined,
            height: typeof w.height === 'number' ? w.height : undefined,
            zIndex: typeof w.zIndex === 'number' ? w.zIndex : undefined
          }));
        serializable.windows = cleaned;
      }

      // Derive active window heuristically by highest zIndex
      if (serializable.windows && serializable.windows.length > 0) {
        const active = [...serializable.windows].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0];
        serializable.activeWindowId = active?.id;
      }

      return serializable;
    } catch {
      return {} as SerializableUIContext;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = new Worker(new URL('./aiWorker.ts', import.meta.url));
      
      this.worker.onmessage = (event) => {
        console.log('[AIManager] Received message from worker:', event.data);
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
        if (type === 'UI_UPDATE_WINDOW') {
          eventBus.emit('ui:update_window', data);
          return;
        }
        if (type === 'UI_ORGANIZE_WINDOWS') {
          eventBus.emit('ui:organize_windows', data);
          return;
        }
        eventBus.emit(`ai:${type.toLowerCase()}`, data);

        // Handle AI_CONVERSATIONAL_RESPONSE events (only these should trigger popups)
        if (type === 'AI_CONVERSATIONAL_RESPONSE') {
          // Only show popup for conversational responses (direct questions/greetings)
          eventBus.emit('ai:ai_conversational_response', {
            response: data.response || 'Jarvis responded'
          });
        }
        // Remove automatic notifications for AI_RESPONSE_GENERATED and TEXT_COMMAND_PROCESSED
        // Actions should speak for themselves without confirmation popups
      };

      this.worker.onerror = (error) => {
        console.error('AI worker error:', error);
        eventBus.emit('ai:error', error);
      };

      this.isInitialized = true;
      eventBus.emit('ai:initialized');

      // Bridge: when input emits transcript updates, forward to worker for stateful processing
      eventBus.on('input:transcript_updated', (data: { transcript: string }) => {
        try {
          const transcript = (data?.transcript || '').trim();
          if (!transcript) return;
          eventBus.emit('ai:processing', { count: 1 });
          this.worker?.postMessage({
            type: 'PROCESS_TEXT_COMMAND',
            data: { transcript, uiContext: this.getSerializableUIContext() }
          });
        } catch (e) {
          eventBus.emit('ai:error', e);
        }
      });

      eventBus.on('system:message', (data: { message: string }) => {
        try {
          const message = (data?.message || '').trim();
          if (!message) return;
          console.log('[AIManager] Received system:message, processing text command:', message);
          this.processTextCommand(`System Note: ${message}`);
        } catch (e) {
          eventBus.emit('ai:error', e);
        }
      });
    } catch (error) {
      console.error('Failed to initialize AI worker:', error);
      eventBus.emit('ai:error', error);
    }
  }

  setUIContext(context: SerializableUIContext): void {
    this.uiContext = context;
    try {
      // Forward context to worker so it can be included in ConversationState
      this.worker?.postMessage({ type: 'SET_UI_CONTEXT', data: this.getSerializableUIContext() });
    } catch {}
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

  generateResponse(prompt: unknown): void {
    if (!this.worker) {
      console.warn('AI worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'GENERATE_RESPONSE',
      data: prompt as object
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