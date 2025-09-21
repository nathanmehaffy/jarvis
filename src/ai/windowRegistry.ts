interface WindowMeta {
  id: string;
  type?: string;
  title?: string;
  content?: string;
  context?: unknown;
  meta?: unknown;
  createdAt?: number;
  zIndex?: number;
  isMinimized?: boolean;
}

class WindowRegistry {
  private windows: WindowMeta[] = [];

  register(window: WindowMeta): void {
    this.windows.push({
      ...window,
      createdAt: window.createdAt || Date.now()
    });
  }

  unregister(windowId: string): void {
    this.windows = this.windows.filter(w => w.id !== windowId);
  }

  getNewest(): WindowMeta | undefined {
    return this.windows
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  }

  getOldest(): WindowMeta | undefined {
    return this.windows
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
  }

  getActive(): WindowMeta | undefined {
    // Return the window with highest zIndex
    return this.windows
      .slice()
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
  }

  getAll(): WindowMeta[] {
    return [...this.windows];
  }

  getById(windowId: string): WindowMeta | undefined {
    return this.windows.find(w => w.id === windowId);
  }

  getByType(type: string): WindowMeta[] {
    return this.windows.filter(w => w.type === type);
  }

  clear(): void {
    this.windows = [];
  }
}

export const windowRegistry = new WindowRegistry();