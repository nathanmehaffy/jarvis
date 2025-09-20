'use client';

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Window } from '../window';
import { WindowData, WindowManagerState } from './windowManager.types';
import { eventBus } from '@/lib/eventBus';

interface WindowManagerProps {
  children: React.ReactNode;
}

export interface WindowManagerRef {
  openWindow: (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => void;
  closeWindow: (windowId: string) => void;
}

export const WindowManager = forwardRef<WindowManagerRef, WindowManagerProps>(({ children }, ref) => {
  const [state, setState] = useState<WindowManagerState>({
    windows: [],
    activeWindowId: null,
    nextZIndex: 10
  });

  const openWindow = (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => {
    setState(prev => ({
      ...prev,
      windows: [
        ...prev.windows.filter(w => w.id !== windowData.id),
        {
          ...windowData,
          isOpen: true,
          zIndex: prev.nextZIndex
        }
      ],
      activeWindowId: windowData.id,
      nextZIndex: prev.nextZIndex + 1
    }));
  };

  const closeWindow = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.filter(w => w.id !== windowId),
      activeWindowId: prev.activeWindowId === windowId ? null : prev.activeWindowId
    }));
  };

  const focusWindow = (windowId: string) => {
    setState(prev => ({
      ...prev,
      activeWindowId: windowId,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, zIndex: prev.nextZIndex }
          : w
      ),
      nextZIndex: prev.nextZIndex + 1
    }));
  };

  useImperativeHandle(ref, () => ({
    openWindow,
    closeWindow
  }));

  // Listen for AI/UI events to open/close windows
  useEffect(() => {
    const unsubs = [
      eventBus.on('ui:open_window', (data: any) => {
        const id = data?.id || `win_${Date.now()}`;
        const title = data?.title || 'Window';
        openWindow({
          id,
          title,
          component: () => (
            <div className="p-4 text-gray-800 text-sm whitespace-pre-wrap">{String(data?.content || '')}</div>
          ),
          x: data?.position?.x ?? 120,
          y: data?.position?.y ?? 120,
          width: data?.size?.width ?? 360,
          height: data?.size?.height ?? 240
        });
      }),
      eventBus.on('ui:close_window', (data: any) => {
        if (data?.windowId) {
          closeWindow(data.windowId);
        }
      })
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Desktop Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-transparent to-cyan-300/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,119,198,0.2),transparent_50%)]"></div>
        {children}
      </div>

      {/* Render Windows */}
      {state.windows.map(window => {
        const WindowComponent = window.component;
        return (
          <Window
            key={window.id}
            id={window.id}
            title={window.title}
            initialX={window.x}
            initialY={window.y}
            width={window.width}
            height={window.height}
            isActive={state.activeWindowId === window.id}
            onClose={() => closeWindow(window.id)}
            onFocus={() => focusWindow(window.id)}
          >
            <WindowComponent />
          </Window>
        );
      })}
    </div>
  );
});