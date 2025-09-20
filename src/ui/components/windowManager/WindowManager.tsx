'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Window } from '../window';
import { ImageWindow } from '../imageWindow';
// import { ConnectionRenderer } from '../connectionRenderer';
// import { ConnectionControls } from '../connectionControls';
import { WindowData, WindowManagerState, Connection } from './windowManager.types';
import { eventBus } from '@/lib/eventBus';
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
  toggleConnections: () => void;
  setSimilarityThreshold: (threshold: number) => void;
}

export const WindowManager = forwardRef<WindowManagerRef, WindowManagerProps>(function WindowManager({ children, onWindowsChange }, ref) {
  const [state, setState] = useState<WindowManagerState>({
    windows: [],
    activeWindowId: null,
    nextZIndex: 10,
    connections: [],
    deletedConnections: new Set<string>(),
    showConnections: true,
    similarityThreshold: 0.1
  });

  // Helper function to create a unique connection ID
  const getConnectionId = (windowId1: string, windowId2: string): string => {
    // Always use consistent ordering to ensure same ID for bidirectional connections
    const [id1, id2] = [windowId1, windowId2].sort();
    return `${id1}--${id2}`;
  };

  const getOptimalPosition = (width: number, height: number, currentWindows: WindowData[]): { x: number; y: number } => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const centerX = Math.max(0, (viewportWidth - width) / 2);
    const centerY = Math.max(0, (viewportHeight - height) / 2);

    if (currentWindows.length === 0) {
      return { x: centerX, y: centerY };
    }

    const occupiedAreas = currentWindows.map(w => ({
      x1: w.x,
      y1: w.y,
      x2: w.x + w.width,
      y2: w.y + w.height
    }));

    const margin = 20;

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

    const tryPositions = [
      { x: centerX, y: centerY },
      { x: margin, y: margin },
      { x: viewportWidth - width - margin, y: margin },
      { x: margin, y: viewportHeight - height - margin },
      { x: viewportWidth - width - margin, y: viewportHeight - height - margin },
      { x: centerX, y: margin },
      { x: centerX, y: viewportHeight - height - margin },
      { x: margin, y: centerY },
      { x: viewportWidth - width - margin, y: centerY }
    ];

    for (const pos of tryPositions) {
      if (pos.x >= 0 && pos.y >= 0 &&
          pos.x + width <= viewportWidth &&
          pos.y + height <= viewportHeight &&
          isPositionFree(pos.x, pos.y, width, height)) {
        return pos;
      }
    }

    const gridStep = 50;
    for (let y = margin; y <= viewportHeight - height - margin; y += gridStep) {
      for (let x = margin; x <= viewportWidth - width - margin; x += gridStep) {
        if (isPositionFree(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    const fineGridStep = 20;
    for (let y = margin; y <= viewportHeight - height - margin; y += fineGridStep) {
      for (let x = margin; x <= viewportWidth - width - margin; x += fineGridStep) {
        if (isPositionFree(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    let bestPosition = { x: centerX, y: centerY };
    let minOverlapArea = Infinity;

    const overlapTestStep = 40;
    for (let y = margin; y <= viewportHeight - height - margin; y += overlapTestStep) {
      for (let x = margin; x <= viewportWidth - width - margin; x += overlapTestStep) {
        const proposedArea = {
          x1: x,
          y1: y,
          x2: x + width,
          y2: y + height
        };

        let totalOverlapArea = 0;
        for (const area of occupiedAreas) {
          const overlapX1 = Math.max(proposedArea.x1, area.x1);
          const overlapY1 = Math.max(proposedArea.y1, area.y1);
          const overlapX2 = Math.min(proposedArea.x2, area.x2);
          const overlapY2 = Math.min(proposedArea.y2, area.y2);

          if (overlapX1 < overlapX2 && overlapY1 < overlapY2) {
            totalOverlapArea += (overlapX2 - overlapX1) * (overlapY2 - overlapY1);
          }
        }

        if (totalOverlapArea < minOverlapArea) {
          minOverlapArea = totalOverlapArea;
          bestPosition = { x, y };

          if (totalOverlapArea === 0) {
            return bestPosition;
          }
        }
      }
    }

    if (minOverlapArea === Infinity) {
      const windowCount = currentWindows.length;
      const cascadeOffset = (windowCount * 25) % 200;
      const cascadeX = Math.min(centerX + cascadeOffset, viewportWidth - width - margin);
      const cascadeY = Math.min(centerY + cascadeOffset, viewportHeight - height - margin);
      bestPosition = { x: Math.max(margin, cascadeX), y: Math.max(margin, cascadeY) };
    }

    return bestPosition;
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
      const scatteredPosition = addNaturalScatter(optimalPosition, windowData.width, windowData.height);

      const newWindow = {
        ...windowData,
        x: scatteredPosition.x,
        y: scatteredPosition.y,
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

      // Emit events after state update completes
      setTimeout(() => {
        const windowPositions = newState.windows.map(w =>
          `${w.title} (${w.id}): x=${Math.round(w.x)}, y=${Math.round(w.y)}, w=${w.width}, h=${w.height}`
        ).join('\n');

        eventBus.emit('system:output', {
          text: `Window opened: ${windowData.title}\nPosition: x=${Math.round(scatteredPosition.x)}, y=${Math.round(scatteredPosition.y)} (smart positioning + scatter)\nSize: ${windowData.width}x${windowData.height}\n\nAll windows:\n${windowPositions}\n\n`
        });

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

  // const toggleConnections = () => {
  //   setState(prev => ({ ...prev, showConnections: !prev.showConnections }));
  // };

  // const setSimilarityThreshold = (threshold: number) => {
  //   setState(prev => ({ ...prev, similarityThreshold: threshold }));
  // };

  // const deleteConnection = (connectionToDelete: Connection) => {
  //   const connectionId = getConnectionId(connectionToDelete.windowId1, connectionToDelete.windowId2);

  //   setState(prev => {
  //     const newDeletedConnections = new Set(prev.deletedConnections);
  //     newDeletedConnections.add(connectionId);

  //     // Remove the connection from active connections and add to deleted list
  //     const updatedConnections = prev.connections.filter(conn =>
  //       !(conn.windowId1 === connectionToDelete.windowId1 &&
  //         conn.windowId2 === connectionToDelete.windowId2) &&
  //       !(conn.windowId1 === connectionToDelete.windowId2 &&
  //         conn.windowId2 === connectionToDelete.windowId1)
  //     );

  //     // Add the deleted connection back with 0% score
  //     updatedConnections.push({
  //       windowId1: connectionToDelete.windowId1,
  //       windowId2: connectionToDelete.windowId2,
  //       score: 0,
  //       keywords: []
  //     });

  //     return {
  //       ...prev,
  //       connections: updatedConnections,
  //       deletedConnections: newDeletedConnections
  //     };
  //   });

  //   // Log the deletion
  //   console.log('🗑️ Connection permanently deleted:', connectionToDelete);
  //   eventBus.emit('system:output', {
  //     text: `🗑️ Connection permanently deleted between "${connectionToDelete.windowId1}" and "${connectionToDelete.windowId2}" - will stay at 0% for session\n`
  //   });
  // };

  useImperativeHandle(ref, () => ({
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleFullscreen,
    getWindows: () => state.windows,
    // toggleConnections,
    // setSimilarityThreshold
  }));

  useEffect(() => {
    if (onWindowsChange) {
      onWindowsChange(state.windows);
    }
  }, [state.windows, onWindowsChange]);

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
            <div className="p-4 text-cyan-200 text-sm whitespace-pre-wrap">{String(data?.content || '')}</div>
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
              ? { ...w, content: data.content, title: data.title || w.title }
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

      {/* Connection Controls */}
      {/* <ConnectionControls
        showConnections={state.showConnections}
        similarityThreshold={state.similarityThreshold}
        onToggleConnections={toggleConnections}
        onThresholdChange={setSimilarityThreshold}
      /> */}

      {/* Connection Renderer */}
      {/* <ConnectionRenderer
        windows={state.windows}
        connections={state.connections}
        isVisible={state.showConnections}
        minSimilarityThreshold={state.similarityThreshold}
        onDeleteConnection={deleteConnection}
      /> */}

      {/* Render Windows */}
      {state.windows.map(window => {
        const WindowComponent = window.component;
        const isImageWindow = window.id.startsWith('image-viewer-');
        
        const imageUrl = window.imageUrl || '';
        
        if (isImageWindow) {
          return (
            <ImageWindow
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
              imageUrl={imageUrl}
              animationState={window.animationState}
            >
              <WindowComponent />
            </ImageWindow>
          );
        }
        
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