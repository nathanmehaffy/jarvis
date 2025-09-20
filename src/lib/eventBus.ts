/* eslint-disable @typescript-eslint/no-explicit-any */
type EventCallback<T = any> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    return () => this.off(event, callback);
  }

  off<T = any>(event: string, callback: EventCallback<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T = any>(event: string, data?: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  once<T = any>(event: string, callback: EventCallback<T>): void {
    const onceCallback = (data: T) => {
      callback(data);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
export type { EventCallback };