'use client';

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Window } from '../window';
import { WindowData, WindowManagerState, WindowGroup } from './windowManager.types';
import { eventBus } from '@/lib/eventBus';

interface WindowManagerProps {
  children: React.ReactNode;
  onWindowsChange?: (windows: WindowData[]) => void;
}

export interface WindowManagerRef {
  createGroup: (name: string, color: string) => void;
  assignWindowToGroup: (windowId: string, groupName: string) => void;
  openWindow: (windowData: Omit<WindowData, 'isOpen' | 'isMinimized' | 'zIndex'>) => void;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  getWindows: () => WindowData[];
}

export const WindowManager = forwardRef<WindowManagerRef, WindowManagerProps>((props, ref) => {
  const { children, onWindowsChange } = props;
  const [groups, setGroups] = useState<Record<string, WindowGroup>>({});
  const [state, setState] = useState<WindowManagerState>({
    windows: [],
    activeWindowId: null,
    nextZIndex: 10
  });

  const openWindow = (windowData: Omit<WindowData, 'isOpen' | 'isMinimized' | 'zIndex'>) => {
    setState(prev => ({
      ...prev,
      windows: [
        ...prev.windows.filter(w => w.id !== windowData.id),
        {
          ...windowData,
          isOpen: true,
          isMinimized: false,
          zIndex: prev.nextZIndex
        }
      ],
      activeWindowId: windowData.id,
      nextZIndex: prev.nextZIndex + 1
    }));
    // Sync with global registry for selector-based operations
    try {
      eventBus.emit('window:opened', { id: windowData.id, type: 'ui', title: windowData.title });
    } catch {}
  };

  const closeWindow = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.filter(w => w.id !== windowId),
      activeWindowId: prev.activeWindowId === windowId ? null : prev.activeWindowId
    }));
    // Sync with global registry
    try {
      eventBus.emit('window:closed', { windowId });
    } catch {}
  };

  const minimizeWindow = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, isMinimized: true }
          : w
      ),
      activeWindowId: null
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
    try {
      eventBus.emit('window:focused', { windowId });
    } catch {}
  };

  
  const createGroup = (name: string, color: string) => {
    setGroups(prev => ({
      ...prev,
      [name.toLowerCase()]: { name, color }
    }));
  };

  const assignWindowToGroup = (windowId: string, groupName: string) => {
    const group = groups[groupName.toLowerCase()];
    if (!group) return;
    
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId ? { ...w, group } : w
      )
    }));
  };

  useImperativeHandle(ref, () => ({
    createGroup,
    assignWindowToGroup,
    openWindow,
    closeWindow,
    minimizeWindow,
    getWindows: () => state.windows
  }));

  useEffect(() => {
    if (onWindowsChange) {
      onWindowsChange(state.windows);
    }
  }, [state.windows, onWindowsChange]);

  // Listen for AI/UI events to open/close windows
  useEffect(() => {
    const unsubs = [
      eventBus.on('window:create_group', (data: any) => {
        if (data?.name && data?.color) {
          createGroup(data.name, data.color);
        }
      }),
      eventBus.on('window:assign_group', (data: any) => {
        if (data?.windowId && data?.groupName) {
          assignWindowToGroup(data.windowId, data.groupName);
        }
      }),
      eventBus.on('ui:open_window', (data: any) => {
  console.log(`[WindowManager] ui:open_window:`, data);
        const id = data?.id || `win_${Date.now()}`;
        const title = data?.title || 'General';
        const urlForWebview = data?.context?.metadata?.url || data?.url;
        openWindow({
          id,
          title,
          component: () => {
            if (urlForWebview) {
              return (
                <iframe
                  src={String(urlForWebview)}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-navigation"
                  referrerPolicy="no-referrer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  loading="lazy"
                  onLoad={(e) => console.log(`[WindowManager] Webview loaded: ${urlForWebview}`)}
                  onError={(e) => console.error(`[WindowManager] Webview error for ${urlForWebview}:`, e)}
                />
              );
            } else {
              return (
                <div className="p-4 text-gray-800 text-sm whitespace-pre-wrap">{String(data?.content || '')}</div>
              );
            }
          },
          content: String(data?.content || ''),
          group: data?.group && typeof data.group === 'object' ? { name: String(data.group.name || ''), color: String(data.group.color || '#6b7280') } as WindowGroup : undefined,
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
            onMinimize={() => minimizeWindow(window.id)}
            onFocus={() => focusWindow(window.id)}
          >
            <WindowComponent />
          </Window>
        );
      })}
    </div>
  );
});