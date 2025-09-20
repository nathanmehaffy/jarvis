export interface WindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onClose?: () => void;
  isActive?: boolean;
  isMinimized: boolean;
  isFullscreen?: boolean;
  onFocus?: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onFullscreen?: () => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onResize?: (width: number, height: number) => void;
  // New props to unify ImageWindow
  lockAspectRatio?: boolean;
  headerStyle?: 'standard' | 'minimal';
  resizable?: boolean;
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  zIndex: number;
}