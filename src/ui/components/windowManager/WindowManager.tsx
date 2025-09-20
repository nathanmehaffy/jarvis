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
    // Do not re-emit a simplified 'window:opened' here; the AI layer already emits
    // a full detail event before this, and re-emitting can overwrite metadata.
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
        const inferTitle = (): string => {
          const provided = String(data?.title || '');
          const current = provided || 'General';
          const ctxType = String(data?.type || data?.context?.type || '').toLowerCase();
          const contentText = String(data?.content || data?.context?.content || '');
          const meta = (data?.context && (data.context as any).metadata) || {};
          const isGeneric = !provided || /untitled/i.test(provided) || provided === 'General';
          if (!isGeneric) return current;
          if (ctxType === 'search-results' && typeof meta.searchQuery === 'string' && meta.searchQuery.length > 0) {
            return `Search: ${meta.searchQuery}`;
          }
          const sum = contentText.match(/Summary of:\s*([^\n]+)/i);
          if (ctxType === 'notes' || sum) {
            if (sum && sum[1]) return `Summary: ${sum[1].trim().slice(0, 60)}`;
            return 'Summary';
          }
          if (/(theorem|lemma|proof|integral|derivative|matrix|vector|algebra|calculus|trigonometry)\b/i.test(contentText) || /[=+\-*/^]/.test(contentText)) {
            return 'Math';
          }
          return current;
        };
        const title = inferTitle();
        const urlForWebview = data?.context?.metadata?.url || data?.url;
        openWindow({
          id,
          title,
          component: (props?: any) => {
            if (urlForWebview && urlForWebview !== 'null' && urlForWebview !== 'undefined') {
              const { useEffect, useState } = require('react');
              const [reader, setReader] = useState<any | null>(null);
              const [loadError, setLoadError] = useState<string | null>(null);
              const [iframeBlocked, setIframeBlocked] = useState(false);
              const [iframeLoaded, setIframeLoaded] = useState(false);
              const [useProxy, setUseProxy] = useState(false);
              const [proxyUrl, setProxyUrl] = useState<string | null>(null);
              const [preflightDone, setPreflightDone] = useState(false);

              const fetchReader = async () => {
                try {
                  console.log(`[WindowManager] Fetching reader for: ${urlForWebview}`);
                  const resp = await fetch('/api/fetch-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: String(urlForWebview) })
                  });
                  if (!resp.ok) throw new Error(`Reader HTTP ${resp.status}`);
                  const data = await resp.json();
                  setReader(data);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error(`[WindowManager] Reader fetch failed:`, msg);
                  setLoadError(msg);
                }
              };

              const testProxy = async () => {
                try {
                  const testUrl = `/api/proxy-page?url=${encodeURIComponent(String(urlForWebview))}`;
                  console.log(`[WindowManager] Testing proxy for: ${urlForWebview}`);
                  const resp = await fetch(testUrl, { method: 'GET' });
                  if (resp.ok) {
                    setProxyUrl(testUrl);
                    setUseProxy(true);
                  } else {
                    console.warn(`[WindowManager] Proxy returned HTTP ${resp.status}, falling back to reader`);
                    fetchReader();
                  }
                } catch (e) {
                  console.warn(`[WindowManager] Proxy test failed, falling back to reader`);
                  fetchReader();
                }
              };

              const preflight = async () => {
                try {
                  const resp = await fetch('/api/fetch-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: String(urlForWebview), mode: 'head' })
                  });
                  if (resp.ok) {
                    const head = await resp.json();
                    if (head?.embeddingBlocked) {
                      console.log(`[WindowManager] Preflight indicates iframe blocked for: ${urlForWebview}`);
                      setIframeBlocked(true);
                      testProxy();
                    }
                  }
                } catch {}
                setPreflightDone(true);
              };

              useEffect(() => {
                preflight();
              }, []);

              useEffect(() => {
                // Auto-fallback after 3s: try proxy first, then reader
                const timer = setTimeout(() => {
                  if (!reader && !loadError && !iframeBlocked && !iframeLoaded) {
                    console.log(`[WindowManager] Auto-fallback: trying proxy for ${urlForWebview}`);
                    setIframeBlocked(true);
                    testProxy();
                  }
                }, 3000);
                return () => clearTimeout(timer);
              }, [reader, loadError, iframeBlocked, iframeLoaded]);

              useEffect(() => {
                if (reader && reader.textContent) {
                  try { 
                    eventBus.emit('window:content_ready', { windowId: id, url: String(urlForWebview), title: reader.title, text: reader.textContent }); 
                    // Update window header title to the article's title when reader loads
                    if (reader.title && typeof reader.title === 'string' && reader.title.length > 0) {
                      eventBus.emit('ui:update_window', { windowId: id, title: reader.title });
                    }
                  } catch {}
                }
              }, [reader]);

              if (!preflightDone) {
                return (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                    Loading...
                  </div>
                );
              } else if (reader) {
                return (
                  <div className="w-full h-full overflow-auto p-4 text-sm text-gray-800">
                    <div className="mb-2 text-xs text-gray-500">Reader view</div>
                    <div className="text-lg font-semibold">{reader.title || title}</div>
                    {reader.byline ? <div className="text-xs text-gray-500 mb-3">{reader.byline}</div> : null}
                    <div className="whitespace-pre-wrap">{reader.textContent || ''}</div>
                    <div className="mt-4 pt-2 border-t border-gray-200">
                      <a href={String(urlForWebview)} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:text-blue-800 text-xs">
                        Open in new tab →
                      </a>
                    </div>
                  </div>
                );
              } else if (useProxy && proxyUrl) {
                return (
                  <iframe
                    src={proxyUrl}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    loading="lazy"
                    onLoad={() => { console.log(`[WindowManager] Proxy webview loaded: ${proxyUrl}`); setIframeLoaded(true); }}
                    onError={() => { 
                      console.error(`[WindowManager] Proxy webview error for ${proxyUrl}`); 
                      setUseProxy(false);
                      fetchReader();
                    }}
                  />
                );
              } else if (iframeBlocked || loadError) {
                return (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="text-center text-gray-600">
                      <div className="mb-2">
                        {loadError ? `Reader error: ${loadError}` : 'Website blocked iframe embedding'}
                      </div>
                      <a href={String(urlForWebview)} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:text-blue-800">
                        Open in new tab →
                      </a>
                    </div>
                  </div>
                );
              } else {
                return (
                  <iframe
                    src={String(urlForWebview)}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    loading="lazy"
                    onLoad={() => { console.log(`[WindowManager] Webview loaded: ${urlForWebview}`); setIframeLoaded(true); }}
                    onError={() => { 
                      console.error(`[WindowManager] Webview error for ${urlForWebview}`); 
                      setIframeBlocked(true);
                      testProxy();
                    }}
                  />
                );
              }
            } else {
              const content = typeof props?.content === 'string' ? props.content : String(data?.content || '');
              return (
                <div className="p-4 text-gray-800 text-sm whitespace-pre-wrap">{content}</div>
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
      eventBus.on('ui:update_window', (data: any) => {
        const { windowId, title, contentUpdate } = data || {};
        if (!windowId) return;
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => {
            if (w.id !== windowId) return w;
            let newContent = String(w.content || '');
            if (contentUpdate) {
              const mode = String(contentUpdate.mode || 'set');
              const text = String(contentUpdate.text || '');
              if (mode === 'set') newContent = text;
              else if (mode === 'append') newContent = (newContent ? newContent + '\n' : '') + text;
              else if (mode === 'prepend') newContent = text + (newContent ? '\n' + newContent : '');
              else if (mode === 'clear') newContent = '';
            }
            return { ...w, title: typeof title === 'string' && title.length > 0 ? title : w.title, content: newContent };
          })
        }));
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