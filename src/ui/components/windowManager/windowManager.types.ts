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
}

export interface WindowManagerState {
  windows: WindowData[];
  activeWindowId: string | null;
  nextZIndex: number;
}