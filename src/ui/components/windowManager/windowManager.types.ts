export interface WindowData {
  id: string;
  title: string;
  // Components can accept a content prop to receive current content each render
  component: React.ComponentType<{ content?: string }>;
  content?: string;
  /** When true, the manager may infer/update the title from content */
  autoTitle?: boolean;
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
  group?: string;
  groupColor?: string;
}

export interface WindowManagerState {
  windows: WindowData[];
  activeWindowId: string | null;
  nextZIndex: number;
}