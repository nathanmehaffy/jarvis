export interface WindowGroup {
  name: string;
  color: string;
}

export interface WindowData {
  id: string;
  title: string;
  component: React.ComponentType;
  content?: string;
  hideTitleBar?: boolean;
  group?: WindowGroup;
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
}