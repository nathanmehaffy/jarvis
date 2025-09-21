'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { Window } from '../window';
import { WindowData, WindowManagerState } from './windowManager.types';
import { eventBus } from '@/lib/eventBus';
import { SearchResultsWindow } from '../searchResults';
import IntegralGraphWindow from '@/ui/components/mathVisual/IntegralGraphWindow';
import AdaptiveQuizWindow from '@/ui/components/adaptiveQuiz/AdaptiveQuizWindow';
import { MarkdownText } from '../markdownText';
// import { contentSimilarityAnalyzer } from '@/lib/contentSimilarity';

interface WindowManagerProps {
  children: React.ReactNode;
  onWindowsChange?: (windows: WindowData[]) => void;
}

export interface WindowManagerRef {
  openWindow: (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => void;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  toggleFullscreen: (windowId: string) => void;
  getWindows: () => WindowData[];
  organizeWindows: () => void;
}

export const WindowManager = forwardRef<WindowManagerRef, WindowManagerProps>(function WindowManager({ children, onWindowsChange }, ref) {
  const [state, setState] = useState<WindowManagerState>({
    windows: [],
    activeWindowId: null,
    nextZIndex: 10
  });

  // Helper function to create a unique connection ID
  // Connections feature removed per decision

  const getOptimalPosition = (width: number, height: number, currentWindows: WindowData[]): { x: number; y: number } => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const margin = 20;
    
    // RESTRICT TO LEFT 95%: right edge cannot exceed 95% (5% reserved for image drop)
    const maxRightEdge = viewportWidth * 0.95;
    const maxAllowedX = maxRightEdge - width;

    // If no windows exist, place at top-left
    if (currentWindows.length === 0) {
      return { x: margin, y: margin };
    }

    const occupiedAreas = currentWindows.map(w => ({
      x1: w.x,
      y1: w.y,
      x2: w.x + w.width,
      y2: w.y + w.height
    }));

    const isPositionFree = (x: number, y: number, testWidth: number, testHeight: number): boolean => {
      const proposedArea = {
        x1: x,
        y1: y,
        x2: x + testWidth,
        y2: y + testHeight
      };

      return !occupiedAreas.some(area =>
        !(proposedArea.x2 <= area.x1 ||
          proposedArea.x1 >= area.x2 ||
          proposedArea.y2 <= area.y1 ||
          proposedArea.y1 >= area.y2)
      );
    };

    // STRICT TOP-LEFT PRIORITY: Scan row by row from top-left
    const stepSize = 15;
    for (let y = margin; y <= viewportHeight - height - margin; y += stepSize) {
      for (let x = margin; x <= maxAllowedX; x += stepSize) {
        if (isPositionFree(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    // If no free space found, use top-left fallback
    return { x: margin, y: margin };
  };

  const getReasonableSize = (requestedWidth?: number, requestedHeight?: number): { width: number; height: number } => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const baseW = Math.round(Math.min(Math.max(viewportWidth * 0.42, 520), 980));
    const baseH = Math.round(Math.min(Math.max(viewportHeight * 0.46, 380), 760));
    return {
      width: requestedWidth ?? baseW,
      height: requestedHeight ?? baseH
    };
  };

  const organizeWindows = () => {
    const imageWindows = state.windows.filter(window => window.id.startsWith('image-viewer-'));
    if (imageWindows.length === 0) return;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const screenArea = viewportWidth * viewportHeight;
    const minAreaPerWindow = screenArea * 0.1; // 10% minimum area requirement

    // Screen constraints
    const margin = 5;
    const maxRightEdge = viewportWidth * 0.95;
    const availableWidth = maxRightEdge - margin * 2;
    const availableHeight = viewportHeight - margin * 2;

    // Calculate conservative sizing for multiple windows
    const conservativeMultiplier = Math.max(1.5, 3.0 - (imageWindows.length * 0.2));
    const totalTargetArea = Math.min(availableWidth * availableHeight * 0.80, imageWindows.length * minAreaPerWindow * conservativeMultiplier);
    const baseAreaPerWindow = totalTargetArea / imageWindows.length;

    console.log(`Organizing ${imageWindows.length} windows with minimum area priority`);

    // Sort by current area (largest first)
    const sortedWindows = imageWindows.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const packedWindows: WindowData[] = [];
    const occupiedRects: Array<{x: number, y: number, width: number, height: number}> = [];

    // Helper to check if position is available
    const canPlaceAt = (x: number, y: number, width: number, height: number): boolean => {
      if (x < 0 || y < 0 || x + width > availableWidth || y + height > availableHeight) return false;

      return !occupiedRects.some(rect =>
        !(x >= rect.x + rect.width + margin ||
          x + width <= rect.x - margin ||
          y >= rect.y + rect.height + margin ||
          y + height <= rect.y - margin)
      );
    };

    // Helper to find best position
    const findBestPosition = (width: number, height: number): {x: number, y: number} | null => {
      for (let y = 0; y <= availableHeight - height; y += 10) {
        for (let x = 0; x <= availableWidth - width; x += 10) {
          if (canPlaceAt(x, y, width, height)) {
            return { x, y };
          }
        }
      }
      return null;
    };

    // Process each window with MINIMUM AREA PRIORITY
    for (const window of sortedWindows) {
      const aspectRatio = window.width / window.height;
      const targetArea = Math.max(minAreaPerWindow, baseAreaPerWindow);

      // Calculate optimal dimensions
      let optimalWidth, optimalHeight;
      if (aspectRatio > 1) {
        optimalWidth = Math.sqrt(targetArea * aspectRatio);
        optimalHeight = Math.sqrt(targetArea / aspectRatio);
      } else {
        optimalHeight = Math.sqrt(targetArea / aspectRatio);
        optimalWidth = Math.sqrt(targetArea * aspectRatio);
      }

      let finalWindow = null;

      // Try 1: Optimal size without overlap
      const optimalPos = findBestPosition(Math.round(optimalWidth), Math.round(optimalHeight));
      if (optimalPos) {
        finalWindow = {
          ...window,
          width: Math.round(optimalWidth),
          height: Math.round(optimalHeight),
          x: optimalPos.x + margin,
          y: optimalPos.y + margin
        };
      } else {
        // Try 2: Scale down but NEVER below minimum area
        const minScale = Math.sqrt(minAreaPerWindow / (optimalWidth * optimalHeight));
        let scaleFactor = 0.9;

        while (scaleFactor >= minScale && !finalWindow) {
          const scaledWidth = Math.round(optimalWidth * scaleFactor);
          const scaledHeight = Math.round(optimalHeight * scaleFactor);

          if (scaledWidth * scaledHeight >= minAreaPerWindow) {
            const scaledPos = findBestPosition(scaledWidth, scaledHeight);
            if (scaledPos) {
              finalWindow = {
                ...window,
                width: scaledWidth,
                height: scaledHeight,
                x: scaledPos.x + margin,
                y: scaledPos.y + margin
              };
            }
          }
          scaleFactor -= 0.05;
        }

        // Try 3: Minimum area size - MUST be placed even with overlap
        if (!finalWindow) {
          const minWidth = Math.round(Math.sqrt(minAreaPerWindow * aspectRatio));
          const minHeight = Math.round(Math.sqrt(minAreaPerWindow / aspectRatio));

          console.warn(`Using minimum area for window ${window.id}: ${minWidth}×${minHeight}`);

          const minPos = findBestPosition(minWidth, minHeight);
          if (minPos) {
            finalWindow = {
              ...window,
              width: minWidth,
              height: minHeight,
              x: minPos.x + margin,
              y: minPos.y + margin
            };
          } else {
            // LAST RESORT: Allow overlap to maintain minimum area
            console.warn(`ALLOWING OVERLAP for window ${window.id} to maintain minimum area requirement`);

            // Find position with minimal overlap
            let bestOverlapPos = { x: margin, y: margin };
            let minOverlap = Infinity;

            for (let y = 0; y <= availableHeight - minHeight; y += 20) {
              for (let x = 0; x <= availableWidth - minWidth; x += 20) {
                if (x >= 0 && y >= 0 && x + minWidth <= availableWidth && y + minHeight <= availableHeight) {
                  let overlapArea = 0;

                  for (const rect of occupiedRects) {
                    const left = Math.max(x, rect.x);
                    const top = Math.max(y, rect.y);
                    const right = Math.min(x + minWidth, rect.x + rect.width);
                    const bottom = Math.min(y + minHeight, rect.y + rect.height);

                    if (left < right && top < bottom) {
                      overlapArea += (right - left) * (bottom - top);
                    }
                  }

                  if (overlapArea < minOverlap) {
                    minOverlap = overlapArea;
                    bestOverlapPos = { x: x + margin, y: y + margin };
                  }
                }
              }
            }

            finalWindow = {
              ...window,
              width: minWidth,
              height: minHeight,
              x: bestOverlapPos.x,
              y: bestOverlapPos.y
            };

            if (minOverlap > 0) {
              console.warn(`Window ${window.id} placed with ${minOverlap}px² overlap (minimum area preserved)`);
            }
          }
        }
      }

      if (finalWindow) {
        packedWindows.push(finalWindow);
        occupiedRects.push({
          x: finalWindow.x - margin,
          y: finalWindow.y - margin,
          width: finalWindow.width,
          height: finalWindow.height
        });
      }
    }

    if (packedWindows.length === 0) return;

    // Update state asynchronously
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        windows: prev.windows.map(window => {
          const optimized = packedWindows.find(pw => pw.id === window.id);
          return optimized ? optimized : window;
        })
      }));
    }, 0);

    // Report results
    const totalArea = packedWindows.reduce((sum, w) => sum + (w.width * w.height), 0);
    const minAreaWindows = packedWindows.filter(w => (w.width * w.height) <= minAreaPerWindow * 1.1);

    // logs muted per decision
  };



  const addNaturalScatter = (position: { x: number; y: number }, width: number, height: number): { x: number; y: number } => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const scatterRangeX = Math.min(120, viewportWidth * 0.08);
    const scatterRangeY = Math.min(80, viewportHeight * 0.06);

    const offsetX = (Math.random() - 0.5) * 2 * scatterRangeX;
    const offsetY = (Math.random() - 0.5) * 2 * scatterRangeY;

    const margin = 30;
    const scatteredX = Math.max(margin, Math.min(viewportWidth - width - margin, position.x + offsetX));
    const scatteredY = Math.max(margin, Math.min(viewportHeight - height - margin, position.y + offsetY));

    return { x: scatteredX, y: scatteredY };
  };

  const inferTitleFromContent = (content?: string, fallback: string = 'Window'): string => {
    const text = (content || '').trim();
    if (!text) return fallback;
    // Use first non-empty line up to 80 chars as inferred title
    const firstLine = text.split(/\n|\r/).map(s => s.trim()).find(Boolean) || fallback;
    return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
  };

  const normalizeTitle = (t?: string): string => {
    if (!t) return '';
    const trimmed = String(t).trim().toLowerCase().replace(/^['"]|['"]$/g, '');
    return trimmed.startsWith('window ')
      ? trimmed.slice('window '.length)
      : trimmed;
  };

  const titlesMatch = (a?: string, b?: string): boolean => {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  };

  const openWindow = (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => {
    console.log('🪟 [WindowManager] openWindow STARTED', {
      windowData: windowData,
      timestamp: new Date().toISOString()
    });

    // Extract keywords from content if available
    // const windowContent = contentSimilarityAnalyzer.processWindowContent(
    //   windowData.id,
    //   windowData.title,
    //   windowData.content || ''
    // );
    setState(prev => {
      console.log('🔄 [WindowManager] setState callback called', {
        prevWindowsCount: prev.windows.length,
        newWindowId: windowData.id,
        timestamp: new Date().toISOString()
      });

      const currentWindows = prev.windows.filter(w => w.id !== windowData.id);

      const size = getReasonableSize(windowData.width, windowData.height);
      const optimalPosition = getOptimalPosition(size.width, size.height, currentWindows);

      console.log('📍 [WindowManager] Calculated optimal position', {
        windowId: windowData.id,
        optimalPosition,
        windowSize: { width: size.width, height: size.height },
        timestamp: new Date().toISOString()
      });

      const inferredTitle = inferTitleFromContent(windowData.content, windowData.title);

      const newWindow = {
        ...windowData,
        title: windowData.title || inferredTitle,
        autoTitle: !windowData.title,
        x: optimalPosition.x,
        y: optimalPosition.y,
        width: size.width,
        height: size.height,
        isOpen: true,
        isFullscreen: false,
        zIndex: prev.nextZIndex,
        animationState: 'opening' as const,
        // keywords: windowContent.keywords,
        contentHash: windowData.content?.slice(0, 100)
      };

      let newState = {
        ...prev,
        windows: [
          ...currentWindows,
          newWindow
        ],
        activeWindowId: windowData.id,
        nextZIndex: prev.nextZIndex + 1
      };

      // Auto-minimize older windows if too many visible
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const maxVisible = viewportWidth < 1280 ? 3 : 4;
      const visible = newState.windows.filter(w => !w.isMinimized);
      if (visible.length > maxVisible) {
        const toMinimizeCount = visible.length - maxVisible;
        const minimizeCandidates = newState.windows
          .filter(w => !w.isMinimized && w.id !== newWindow.id)
          .slice(0, toMinimizeCount);
        newState = {
          ...newState,
          windows: newState.windows.map(w =>
            minimizeCandidates.find(m => m.id === w.id)
              ? { ...w, isMinimized: true }
              : w
          )
        };
      }

      console.log('✨ [WindowManager] New state prepared', {
        windowId: windowData.id,
        totalWindows: newState.windows.length,
        newWindow: newWindow,
        timestamp: new Date().toISOString()
      });

      // Emit only lightweight event; logs muted
      setTimeout(() => {
        try {
          eventBus.emit('window:opened', { id: windowData.id, type: 'ui', title: windowData.title });
          console.log('📢 [WindowManager] Emitted window:opened event', {
            windowId: windowData.id,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ [WindowManager] Failed to emit window:opened event', {
            error,
            timestamp: new Date().toISOString()
          });
        }
      }, 0);

      // Reset animation state after opening animation completes
      setTimeout(() => {
        setState(currentState => ({
          ...currentState,
          windows: currentState.windows.map(w =>
            w.id === windowData.id
              ? { ...w, animationState: 'none' as const }
              : w
          )
        }));
        console.log('🎬 [WindowManager] Animation state reset', {
          windowId: windowData.id,
          timestamp: new Date().toISOString()
        });
      }, 80);

      console.log('✅ [WindowManager] openWindow COMPLETED, returning new state');
      return newState;
    });
  };

  const closeWindow = (windowId: string) => {
    // First set the closing animation state
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, animationState: 'closing' as const }
          : w
      )
    }));
    // After animation completes, remove the window
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        windows: prev.windows.filter(w => w.id !== windowId),
        activeWindowId: prev.activeWindowId === windowId ? null : prev.activeWindowId
      }));

      // Emit event after window is removed
      setTimeout(() => {
        try {
          eventBus.emit('window:closed', { windowId });
        } catch {}
      }, 0);
    }, 250); // Match the closing animation duration
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

  const restoreWindow = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, isMinimized: false }
          : w
      ),
      activeWindowId: windowId
    }));
  };

  const toggleFullscreen = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, isFullscreen: !w.isFullscreen }
          : w
      ),
      activeWindowId: windowId
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

    // Emit event after state update completes
    setTimeout(() => {
      try {
        eventBus.emit('window:focused', { windowId });
      } catch {}
    }, 0);
  };

  const updateWindowPosition = (windowId: string, x: number, y: number) => {
    // Use requestAnimationFrame to batch position updates
    requestAnimationFrame(() => {
      setState(prev => ({
        ...prev,
        windows: prev.windows.map(w =>
          w.id === windowId
            ? { ...w, x, y }
            : w
        )
      }));

      // Emit event for real-time connection updates (throttled)
      setTimeout(() => {
        try {
          eventBus.emit('window:position_changed', { windowId, x, y });
        } catch {}
      }, 0);
    });
  };

  // Connections feature removed per decision

  useImperativeHandle(ref, () => ({
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleFullscreen,
    getWindows: () => state.windows,
    organizeWindows
  }));

  useEffect(() => {
    if (onWindowsChange) {
      onWindowsChange(state.windows);
    }
  }, [state.windows, onWindowsChange]);

  // Defer window open/close side-effects to after render commit
  // to avoid cross-component state updates during render.
  const prevWindowsRef = useRef<WindowData[] | null>(null);

  useEffect(() => {
    const prevWindows = prevWindowsRef.current || undefined;
    const currWindows = state.windows;

    const prevIds = new Set((prevWindows || []).map(w => w.id));
    const currIds = new Set(currWindows.map(w => w.id));

    // Newly opened windows (logs muted)
    currWindows.forEach(w => {
      if (!prevIds.has(w.id)) {
        try {
          eventBus.emit('window:opened', { id: w.id, type: 'ui', title: w.title });
        } catch {}
      }
    });

    // Closed windows
    if (prevWindows) {
      prevWindows.forEach(w => {
        if (!currIds.has(w.id)) {
          try {
            eventBus.emit('window:closed', { windowId: w.id });
          } catch {}
        }
      });
    }

    prevWindowsRef.current = currWindows;
  }, [state.windows]);

  useEffect(() => {
    const unsubs = [
      eventBus.on('ui:open_window', (data: { id?: string; title?: string; content?: string; type?: string; position?: { x?: number; y?: number }; size?: { width?: number; height?: number } }) => {
        console.log('🎨 [WindowManager] ui:open_window event received', {
          data: data,
          timestamp: new Date().toISOString()
        });

        const id = data?.id || `win_${Date.now()}`;
        const title = data?.title || 'Window';
        const content = String(data?.content || '');

        console.log('🔧 [WindowManager] Processing window data', {
          id, title, content: content.slice(0, 100) + '...', type: data?.type,
          timestamp: new Date().toISOString()
        });

        // Attempt to auto-detect LaTeX integral in content and open a graph window
        try {
          if (data?.type !== 'math-visual') {
            const integralMatch = content.match(/\\int_\{([^}]*)\}\^\{([^}]*)\}\s*([\s\S]*?)\s*d([a-zA-Z])/);
            if (integralMatch) {
              const lower = Number(integralMatch[1]);
              const upper = Number(integralMatch[2]);
              let expr = integralMatch[3];
              const variable = integralMatch[4];
              if (Number.isFinite(lower) && Number.isFinite(upper)) {
                expr = expr
                  .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
                  .replace(/\\cdot/g, '*')
                  .replace(/\\left\(/g, '(')
                  .replace(/\\right\)/g, ')')
                  .replace(/\\,/g, ' ')
                  .replace(/\^\{([^}]*)\}/g, '^($1)');
                setTimeout(() => {
                  eventBus.emit('ui:open_window', {
                    type: 'math-visual',
                    title: `Graph of f(${variable}) over [${lower}, ${upper}]`,
                    expression: expr,
                    variable,
                    lower,
                    upper,
                    size: { width: 860, height: 600 }
                  });
                }, 0);
              }
            }
          }
        } catch {}

        // Determine component based on type
        let component: React.ComponentType;
        if (data?.type === 'search-results') {
          console.log('🔍 [WindowManager] Creating SearchResultsWindow component');
          component = () => <SearchResultsWindow content={content} />;
        } else if (data?.type === 'adaptive-quiz') {
          const anyData = data as any;
          const topic = String(anyData?.topic || 'addition');
          component = () => <AdaptiveQuizWindow topic={topic as any} windowId={id} />;
        } else if (data?.type === 'math-visual') {
          console.log('🧮 [WindowManager] Creating IntegralGraphWindow component');
          const anyData = data as any;
          const expression = String(anyData?.expression || 'sin(x)');
          const variable = String(anyData?.variable || 'x');
          const lower = Number(anyData?.lower ?? 0);
          const upper = Number(anyData?.upper ?? Math.PI);
          const samples = Number(anyData?.samples ?? 200);
          component = () => (
            <IntegralGraphWindow
              expression={expression}
              variable={variable}
              lower={lower}
              upper={upper}
              samples={samples}
              title={title}
            />
          );
        } else {
          console.log('📄 [WindowManager] Creating generic window component');
          component = ({ content }: { content?: string }) => (
            <div className="p-4 h-full">
              <MarkdownText className="text-sm">
                {String(content || '')}
              </MarkdownText>
            </div>
          );
        }

        const windowConfig = {
          id,
          title,
          content,
          component,
          isMinimized: false,
          isFullscreen: false,
          x: data?.position?.x ?? 0,
          y: data?.position?.y ?? 0,
          width: data?.size?.width ?? 500,
          height: data?.size?.height ?? 400
        };

        console.log('🚀 [WindowManager] Calling openWindow with config', {
          windowConfig,
          timestamp: new Date().toISOString()
        });

        try {
          openWindow(windowConfig);
          console.log('✅ [WindowManager] openWindow called successfully');
        } catch (error) {
          console.error('❌ [WindowManager] openWindow failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
        }
      }),
      eventBus.on('ui:close_window', (data: { windowId?: string }) => {
        if (data?.windowId) {
          closeWindow(data.windowId);
        }
      }),
      eventBus.on('window:content_changed', (data: { windowId: string; content: string; title?: string }) => {
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w =>
            w.id === data.windowId
              ? {
                  ...w,
                  content: data.content,
                  title: data.title || (w.autoTitle ? inferTitleFromContent(data.content, w.title) : w.title)
                }
              : w
          )
        }));

        // Re-analyze similarities after a short delay to debounce rapid changes
        // setTimeout(() => {
        //   setState(currentState => {
        //     analyzeWindowSimilarities(currentState.windows, currentState);
        //     return currentState;
        //   });
        // }, 500);
      }),
      // Generic window update: supports title/content changes by id or fuzzy title match
      eventBus.on('ui:update_window', (data: { windowId?: string; titleMatch?: string; newTitle?: string; newContent?: string }) => {
        const { windowId, titleMatch, newTitle, newContent } = data || {};
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => {
            const noSelector = !windowId && !titleMatch;
            const isTarget = (windowId && w.id === windowId)
              || (titleMatch && titlesMatch(w.title, String(titleMatch)))
              || (noSelector && prev.activeWindowId && w.id === prev.activeWindowId);
            if (!isTarget) return w;
            const updatedTitle = typeof newTitle === 'string' && newTitle.length > 0
              ? newTitle
              : (w.autoTitle && typeof newContent === 'string' ? inferTitleFromContent(newContent, w.title) : w.title);
            return {
              ...w,
              title: updatedTitle,
              content: typeof newContent === 'string' ? newContent : w.content,
              autoTitle: newTitle ? false : w.autoTitle
            };
          })
        }));
      })
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, []);

  return (
    <div 
      className="relative w-full h-full"
      onClick={() => setState(prev => ({ ...prev, activeWindowId: null }))}
    >
      {/* Desktop Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-transparent to-cyan-300/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,119,198,0.2),transparent_50%)]"></div>
        {children}
      </div>

      {/* Connections feature removed */}

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
            headerStyle={window.id.startsWith('image-viewer-') ? 'minimal' : 'standard'}
            lockAspectRatio={window.id.startsWith('image-viewer-')}
            resizable
            isActive={state.activeWindowId === window.id}
            isMinimized={window.isMinimized}
            isFullscreen={window.isFullscreen}
            zIndex={window.zIndex}
            onClose={() => closeWindow(window.id)}
            onMinimize={() => minimizeWindow(window.id)}
            onRestore={() => restoreWindow(window.id)}
            onFullscreen={() => toggleFullscreen(window.id)}
            onFocus={() => focusWindow(window.id)}
            onPositionChange={updateWindowPosition}
            animationState={window.animationState}
          >
            <WindowComponent {...(window.content !== undefined ? { content: window.content } : {})} />
          </Window>
        );
      })}
    </div>
  );
});