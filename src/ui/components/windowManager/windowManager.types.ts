export interface WindowData {
  id: string;
  title: string;
  component: React.ComponentType;
  content?: string;
  isOpen: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  imageUrl?: string;
  animationState?: 'opening' | 'closing' | 'none';
  keywords?: string[];
  contentHash?: string;
}

export interface WindowManagerState {
  windows: WindowData[];
  activeWindowId: string | null;
  nextZIndex: number;
  connections: Connection[];
  deletedConnections: Set<string>; // Store deleted connection IDs
  showConnections: boolean;
  similarityThreshold: number;
}

export interface Connection {
  windowId1: string;
  windowId2: string;
  score: number;
  keywords: string[];
}