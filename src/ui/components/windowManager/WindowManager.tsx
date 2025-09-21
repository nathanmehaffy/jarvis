'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { Window } from '../window';
import { WindowData, WindowManagerState } from './windowManager.types';
import { eventBus } from '@/lib/eventBus';
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

  // const analyzeWindowSimilarities = useCallback((windows: WindowData[], currentState: WindowManagerState) => {
  //   console.log('🔍 Starting similarity analysis...');
  //   eventBus.emit('system:output', { text: '🔍 Starting similarity analysis...\n' });

  //   const windowContents = windows
  //     .filter(w => w.isOpen && !w.isMinimized)
  //     .map(w => contentSimilarityAnalyzer.processWindowContent(
  //       w.id,
  //       w.title,
  //       w.content || ''
  //     ));

  //   const windowsInfo = windowContents.map(w => ({
  //     id: w.id,
  //     title: w.title,
  //     content: w.content.slice(0, 50) + '...',
  //     keywords: w.keywords,
  //     wordCount: w.wordCount
  //   }));

  //   console.log('📊 Window contents processed:', windowsInfo);
  //   eventBus.emit('system:output', {
  //     text: `📊 Window contents processed:\n${JSON.stringify(windowsInfo, null, 2)}\n\n`
  //   });

  //   const similarities = contentSimilarityAnalyzer.analyzeSimilarities(windowContents);
  //   console.log('🔗 Found similarities:', similarities);
  //   eventBus.emit('system:output', {
  //     text: `🔗 Found similarities:\n${JSON.stringify(similarities, null, 2)}\n\n`
  //   });

  //   const connections: Connection[] = similarities
  //     .map(sim => ({
  //       windowId1: sim.windowId1,
  //       windowId2: sim.windowId2,
  //       score: sim.score,
  //       keywords: sim.keywords
  //     }))
  //     .filter(conn => {
  //       const connectionId = getConnectionId(conn.windowId1, conn.windowId2);
  //       // Filter out deleted connections - keep them in state but set score to 0
  //       if (currentState.deletedConnections.has(connectionId)) {
  //         return false; // Don't include deleted connections in the active list
  //       }
  //       return true;
  //     });

  //   // Add deleted connections back with 0% score for display
  //   const deletedConnectionsToShow: Connection[] = [];
  //   currentState.deletedConnections.forEach(deletedId => {
  //     const [windowId1, windowId2] = deletedId.split('--');
  //     // Only add if both windows still exist
  //     if (windows.some(w => w.id === windowId1) && windows.some(w => w.id === windowId2)) {
  //       deletedConnectionsToShow.push({
  //         windowId1,
  //         windowId2,
  //         score: 0,
  //         keywords: []
  //       });
  //     }
  //   });

  //   const allConnections = [...connections, ...deletedConnectionsToShow];

  //   console.log('✅ Created connections:', allConnections);
  //   eventBus.emit('system:output', {
  //     text: `✅ Created connections:\n${JSON.stringify(allConnections, null, 2)}\n\n`
  //   });

  //   setState(prev => ({ ...prev, connections: allConnections }));
  // }, []);


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

  const openWindow = (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => {
    // Extract keywords from content if available
    // const windowContent = contentSimilarityAnalyzer.processWindowContent(
    //   windowData.id,
    //   windowData.title,
    //   windowData.content || ''
    // );
    setState(prev => {
      const currentWindows = prev.windows.filter(w => w.id !== windowData.id);

      const optimalPosition = getOptimalPosition(windowData.width, windowData.height, currentWindows);

      const inferredTitle = inferTitleFromContent(windowData.content, windowData.title);

      const newWindow = {
        ...windowData,
        title: windowData.title || inferredTitle,
        autoTitle: !windowData.title,
        x: optimalPosition.x,
        y: optimalPosition.y,
        isOpen: true,
        isFullscreen: false,
        zIndex: prev.nextZIndex,
        animationState: 'opening' as const,
        // keywords: windowContent.keywords,
        contentHash: windowData.content?.slice(0, 100)
      };

      const newState = {
        ...prev,
        windows: [
          ...currentWindows,
          newWindow
        ],
        activeWindowId: windowData.id,
        nextZIndex: prev.nextZIndex + 1
      };

      // Emit only lightweight event; logs muted
      setTimeout(() => {
        try {
          eventBus.emit('window:opened', { id: windowData.id, type: 'ui', title: windowData.title });
        } catch {}
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
      }, 80);

      // Trigger similarity analysis after state is updated
      // setTimeout(() => {
      //   analyzeWindowSimilarities(newState.windows, newState);
      // }, 100);

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
      eventBus.on('ui:open_window', (data: { id?: string; title?: string; content?: string; position?: { x?: number; y?: number }; size?: { width?: number; height?: number } }) => {
        const id = data?.id || `win_${Date.now()}`;
        const title = data?.title || 'Window';
        openWindow({
          id,
          title,
          content: String(data?.content || ''),
          component: () => (
            <div className="p-4">
              <MarkdownText className="text-sm">
                {String(data?.content || '')}
              </MarkdownText>
            </div>
          ),
          isMinimized: false,
          isFullscreen: false,
          x: 0,
          y: 0,
          width: data?.size?.width ?? 500,
          height: data?.size?.height ?? 400
        });
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
      // Generic window update: supports title/content changes by id or title match
      eventBus.on('ui:update_window', (data: { windowId?: string; titleMatch?: string; newTitle?: string; newContent?: string }) => {
        const { windowId, titleMatch, newTitle, newContent } = data || {} as any;
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => {
            const isTarget = (windowId && w.id === windowId) || (titleMatch && w.title.toLowerCase() === String(titleMatch).toLowerCase());
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
            <WindowComponent />
          </Window>
        );
      })}
    </div>
  );
});