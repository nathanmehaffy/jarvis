/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/lib/eventBus';

export interface RegisteredWindow {
  id: string;
  type: string;
  title?: string;
  createdAt: number;
  meta?: any;
}

export interface WindowRegistryAPI {
  add(entry: RegisteredWindow): void;
  remove(windowId: string): void;
  getNewest(): RegisteredWindow | undefined;
  getOldest(): RegisteredWindow | undefined;
  getAll(): RegisteredWindow[];
  getActive(): RegisteredWindow | undefined;
}

class WindowRegistry implements WindowRegistryAPI {
  private windows: RegisteredWindow[] = [];
  private activeWindowId: string | null = null;

  constructor() {
    // Listen to open/close events to keep registry updated
    eventBus.on('window:opened', (data: any) => {
      if (!data?.id) return;
      this.add({
        id: data.id,
        type: data.type,
        title: data.title,
        createdAt: Date.now(),
        meta: data
      });
      this.activeWindowId = data.id;
    });

    eventBus.on('window:closed', (data: any) => {
      if (!data?.windowId) return;
      this.remove(data.windowId);
      if (this.activeWindowId === data.windowId) {
        this.activeWindowId = null;
      }
    });

    // Optional: track focus changes from UI
    eventBus.on('window:focused', (data: any) => {
      if (data?.windowId) this.activeWindowId = data.windowId;
    });
  }

  add(entry: RegisteredWindow): void {
    // Avoid duplicates
    this.windows = this.windows.filter(w => w.id !== entry.id);
    this.windows.push(entry);
  }

  remove(windowId: string): void {
    this.windows = this.windows.filter(w => w.id !== windowId);
  }

  getNewest(): RegisteredWindow | undefined {
    if (this.windows.length === 0) return undefined;
    return this.windows.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  }

  getOldest(): RegisteredWindow | undefined {
    if (this.windows.length === 0) return undefined;
    return this.windows.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
  }

  getAll(): RegisteredWindow[] {
    return [...this.windows];
  }

  getActive(): RegisteredWindow | undefined {
    if (!this.activeWindowId) return undefined;
    return this.windows.find(w => w.id === this.activeWindowId);
  }
}

export const windowRegistry: WindowRegistryAPI = new WindowRegistry();


