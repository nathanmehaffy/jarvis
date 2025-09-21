import { eventBus } from '@/lib/eventBus';
import { imageDescriptionService } from './imageDescriptionService';

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
  content?: string;
  windowType?: string;
  imageUrl?: string;
  keywords?: string[];
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
            zIndex: typeof w.zIndex === 'number' ? w.zIndex : undefined,
            content: this.extractWindowContent(w),
            windowType: this.inferWindowType(w),
            imageUrl: typeof w.imageUrl === 'string' ? w.imageUrl : undefined,
            keywords: Array.isArray(w.keywords) ? w.keywords : undefined
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

  private extractWindowContent(window: Record<string, unknown>): string | undefined {
    try {
      // Extract content based on window type and available data
      if (typeof window.content === 'string' && window.content.trim()) {
        const windowType = this.inferWindowType(window);

        // For search results, extract key information and headlines
        if (windowType === 'search-results' && window.content.length > 200) {
          const lines = window.content.split('\n').filter(line => line.trim());
          const summary = lines.slice(0, 10).join('\n');
          return summary + (lines.length > 10 ? '\n... (content truncated)' : '');
        }

        // For webview, extract the URL being viewed
        if (windowType === 'webview') {
          const urlMatch = window.content.match(/URL:\s*(.+)/);
          const url = urlMatch ? urlMatch[1] : '';
          return `[Web Page] ${url ? `Viewing: ${url}` : 'Loading web content'}`;
        }

        // For regular content, truncate if too long
        return window.content.length > 500 ?
          window.content.substring(0, 500) + '... (content truncated)' :
          window.content;
      }

      // For image windows, try to get enhanced description
      if (typeof window.imageUrl === 'string' && window.imageUrl) {
        const cachedDescription = imageDescriptionService.getCachedDescription(window.imageUrl);
        if (cachedDescription) {
          return cachedDescription;
        }
        // Trigger background description generation
        const title = typeof window.title === 'string' ? window.title : 'Untitled';
        imageDescriptionService.preloadDescription(window.imageUrl, title);
        return `[Image: ${title}]`;
      }

      // Extract context for special window types based on localStorage or other sources
      const windowType = this.inferWindowType(window);
      return windowType ? this.extractSpecialWindowContext(window, windowType) : undefined;
    } catch {
      return undefined;
    }
  }

  private extractSpecialWindowContext(window: Record<string, unknown>, windowType: string): string | undefined {
    try {
      switch (windowType) {
        case 'tasks':
          return this.extractTasksContext();

        case 'webview':
          // Try to extract URL from window properties
          if (typeof window.url === 'string' && window.url) {
            return `[Web Page] Viewing: ${window.url}`;
          }
          return '[Web Page] Loading...';

        case 'adaptive-quiz':
          return '[Interactive Quiz] Active learning session';

        case 'integral-graph':
          return '[Math Visualization] Integral graph display';

        case 'pdf-viewer':
          const docTitle = typeof window.title === 'string' ? window.title : 'Untitled document';
          return `[PDF Document] ${docTitle}`;

        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }

  private extractTasksContext(): string {
    try {
      const stored = localStorage.getItem('jarvis.tasks');
      if (!stored) return '[Tasks] No tasks yet';

      const tasks = JSON.parse(stored);
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return '[Tasks] No tasks yet';
      }

      const pendingTasks = tasks.filter(t => !t.done);
      const completedTasks = tasks.filter(t => t.done);

      let summary = `[Tasks] ${pendingTasks.length} pending, ${completedTasks.length} completed`;

      if (pendingTasks.length > 0) {
        const recentPending = pendingTasks.slice(0, 3).map(t => `- ${t.title}`).join('\n');
        summary += `\nRecent pending:\n${recentPending}`;
      }

      return summary;
    } catch {
      return '[Tasks] Error loading tasks';
    }
  }

  private inferWindowType(window: Record<string, unknown>): string | undefined {
    try {
      // Infer window type from ID patterns
      const id = typeof window.id === 'string' ? window.id : '';
      if (id.includes('search')) return 'search-results';
      if (id.includes('image')) return 'image-viewer';
      if (id.includes('webview')) return 'webview';
      if (id.includes('note') || id.includes('sticky')) return 'sticky-note';
      if (id.includes('task')) return 'tasks';
      if (id.includes('quiz')) return 'adaptive-quiz';
      if (id.includes('integral')) return 'integral-graph';
      if (id.includes('pdf')) return 'pdf-viewer';

      // Infer from title patterns
      const title = typeof window.title === 'string' ? window.title.toLowerCase() : '';
      if (title.includes('search') || title.includes('results')) return 'search-results';
      if (title.includes('image') || title.includes('photo') || title.includes('picture')) return 'image-viewer';
      if (title.includes('note')) return 'sticky-note';
      if (title.includes('task') || title.includes('todo')) return 'tasks';
      if (title.includes('web') || title.includes('browser')) return 'webview';

      return 'unknown';
    } catch {
      return 'unknown';
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