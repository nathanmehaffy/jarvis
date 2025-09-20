export interface WindowData {
  id: string;
  title: string;
  component: React.ComponentType;
  isOpen: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface WindowManagerState {
  windows: WindowData[];
  activeWindowId: string | null;
  nextZIndex: number;
}