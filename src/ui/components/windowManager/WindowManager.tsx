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
  onWindowClick?: (windowId: string) => void;
}

export interface WindowManagerRef {
  openWindow: (windowData: Omit<WindowData, 'isOpen' | 'zIndex'>) => void;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  toggleFullscreen: (windowId: string) => void;
  getWindows: () => WindowData[];
  organizeWindows: () => void;
  // Category management (separate from assignment)
  createCategory: (categoryName: string) => void;
  deleteCategory: (categoryName: string) => void;
  getAllCategories: () => string[];
  // Window assignment to categories
  assignWindowToCategory: (windowId: string, categoryName: string) => void;
  removeWindowFromCategory: (windowId: string) => void;
  getAvailableGroups: () => string[]; // Keep for backward compatibility
}

// Color palette for groups
const GROUP_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red  
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F43F5E', // rose
];

// Helper function to get color for a group (ensures unique colors)
const getGroupColor = (groupName: string, existingCategories: string[] = [], existingColorMap: Record<string, string> = {}): string => {
  if (!groupName) return '#6B7280'; // default gray
  
  // Get colors already used by existing categories
  const usedColors = new Set<string>();
  existingCategories.forEach(cat => {
    // If we already assigned a color explicitly, use that
    if (existingColorMap[cat]) {
      usedColors.add(existingColorMap[cat]);
      return;
    }
    // Fallback to hash mapping if not explicitly stored
    let hash = 0;
    for (let i = 0; i < cat.length; i++) {
      hash = ((hash << 5) - hash + cat.charCodeAt(i)) & 0xffffffff;
    }
    usedColors.add(GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]);
  });
  
  // Try to get a unique color for this category
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = ((hash << 5) - hash + groupName.charCodeAt(i)) & 0xffffffff;
  }
  
  let colorIndex = Math.abs(hash) % GROUP_COLORS.length;
  let selectedColor = GROUP_COLORS[colorIndex];
  
  // If color is already used, find the next available color
  while (usedColors.has(selectedColor)) {
    colorIndex = (colorIndex + 1) % GROUP_COLORS.length;
    selectedColor = GROUP_COLORS[colorIndex];
    
    // If we've checked all colors and they're all used, allow duplicates
    // (This handles the edge case where there are more categories than colors)
    if (usedColors.size >= GROUP_COLORS.length) {
      break;
    }
  }
  
  return selectedColor;
};

export const WindowManager = forwardRef<WindowManagerRef, WindowManagerProps>(function WindowManager({ children, onWindowsChange, onWindowClick }, ref) {
  const [state, setState] = useState<WindowManagerState>({
    windows: [],
    activeWindowId: null,
    nextZIndex: 10
  });
  
  // Separate state for managing categories
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});

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
    const allWindows = state.windows.filter(window => window.isOpen && !window.isMinimized);
    if (allWindows.length === 0) return;

    // Separate image windows from generated windows
    const imageWindows = allWindows.filter(window => window.id.startsWith('image-viewer-'));
    const generatedWindows = allWindows.filter(window => !window.id.startsWith('image-viewer-'));

    console.log(`Organizing ${imageWindows.length} image windows (optimized) + ${generatedWindows.length} generated windows (default size)`);

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const screenArea = viewportWidth * viewportHeight;
    const minAreaPerWindow = screenArea * 0.1; // 10% minimum area requirement

    // Screen constraints
    const margin = 5;
    const maxRightEdge = viewportWidth * 0.95;
    const availableWidth = maxRightEdge - margin * 2;
    const availableHeight = viewportHeight - margin * 2;

    // PHASE 1: Optimize image windows only
    let packedWindows: WindowData[] = [];
    let occupiedRects: Array<{x: number, y: number, width: number, height: number}> = [];

    if (imageWindows.length > 0) {
      // Calculate conservative sizing for image windows only
      const conservativeMultiplier = Math.max(1.5, 3.0 - (imageWindows.length * 0.2));
      const totalTargetArea = Math.min(availableWidth * availableHeight * 0.80, imageWindows.length * minAreaPerWindow * conservativeMultiplier);
      const baseAreaPerWindow = totalTargetArea / imageWindows.length;

      // Sort image windows by current area (largest first)
      const sortedImageWindows = imageWindows.sort((a, b) => (b.width * b.height) - (a.width * a.height));

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

      // Process image windows with MINIMUM AREA PRIORITY
      for (const window of sortedImageWindows) {
      // Ensure reasonable aspect ratio bounds (prevent extreme ratios)
      const rawAspectRatio = window.width / window.height;
      const aspectRatio = Math.max(0.2, Math.min(5.0, rawAspectRatio)); // Clamp between 1:5 and 5:1
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
    }

    // PHASE 2: Place generated windows at their current size
    for (const window of generatedWindows) {
      // Keep current dimensions for generated windows
      const currentWidth = window.width;
      const currentHeight = window.height;

      // Try to find available space without overlap
      let bestPosition = null;
      
      // Helper to check if position is available for generated windows
      const canPlaceGeneratedAt = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x + currentWidth > availableWidth || y + currentHeight > availableHeight) return false;

        return !occupiedRects.some(rect =>
          !(x >= rect.x + rect.width + margin ||
            x + currentWidth <= rect.x - margin ||
            y >= rect.y + rect.height + margin ||
            y + currentHeight <= rect.y - margin)
        );
      };

      // Try to find non-overlapping position with systematic search
      // Use a finer grid for better placement options
      for (let y = 0; y <= availableHeight - currentHeight && !bestPosition; y += 15) {
        for (let x = 0; x <= availableWidth - currentWidth && !bestPosition; x += 15) {
          if (canPlaceGeneratedAt(x, y)) {
            bestPosition = { x: x + margin, y: y + margin };
            console.log(`Generated window ${window.id} placed without overlap at (${bestPosition.x}, ${bestPosition.y})`);
          }
        }
      }

      // If no non-overlapping space found, find position with minimal overlap
      if (!bestPosition) {
        console.warn(`No non-overlapping space for generated window ${window.id}, finding minimal overlap position`);
        
        let minOverlapPosition = { x: margin, y: margin };
        let minOverlapArea = Infinity;

        // Try different positions and find the one with least overlap
        for (let y = 0; y <= availableHeight - currentHeight; y += 30) {
          for (let x = 0; x <= availableWidth - currentWidth; x += 30) {
            if (x >= 0 && y >= 0 && x + currentWidth <= availableWidth && y + currentHeight <= availableHeight) {
              let overlapArea = 0;

              // Calculate total overlap with existing windows
              for (const rect of occupiedRects) {
                const left = Math.max(x, rect.x);
                const top = Math.max(y, rect.y);
                const right = Math.min(x + currentWidth, rect.x + rect.width);
                const bottom = Math.min(y + currentHeight, rect.y + rect.height);

                if (left < right && top < bottom) {
                  overlapArea += (right - left) * (bottom - top);
                }
              }

              // Prefer positions with less overlap, and bias towards top-left when overlap is equal
              const topLeftBias = (x + y) * 0.1; // Small bias towards top-left
              const totalScore = overlapArea + topLeftBias;

              if (totalScore < minOverlapArea + (minOverlapPosition.x + minOverlapPosition.y) * 0.1) {
                minOverlapArea = overlapArea;
                minOverlapPosition = { x: x + margin, y: y + margin };
              }
            }
          }
        }

        bestPosition = minOverlapPosition;
        
        if (minOverlapArea > 0) {
          console.warn(`Generated window ${window.id} placed with ${Math.round(minOverlapArea)}px² overlap at (${bestPosition.x}, ${bestPosition.y})`);
        }
      }

      const placedWindow = {
        ...window,
        x: bestPosition.x,
        y: bestPosition.y,
        width: currentWidth,
        height: currentHeight
      };

      packedWindows.push(placedWindow);
      
      // Add to occupied rects for future windows (but allow some overlap for generated windows)
      occupiedRects.push({
        x: placedWindow.x - margin,
        y: placedWindow.y - margin, 
        width: currentWidth,
        height: currentHeight
      });
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
    const organizedImageWindows = packedWindows.filter(w => w.id.startsWith('image-viewer-'));
    const organizedGeneratedWindows = packedWindows.filter(w => !w.id.startsWith('image-viewer-'));
    
    console.log(`✅ Organized: ${organizedImageWindows.length} image windows (optimized) + ${organizedGeneratedWindows.length} generated windows (default size)`);

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

      const newWindow = {
        ...windowData,
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

  // Category management functions
  const createCategory = (categoryName: string) => {
    if (categoryName.trim() && !categories.includes(categoryName.trim())) {
      const trimmedName = categoryName.trim();
      const uniqueColor = getGroupColor(trimmedName, categories, categoryColors);
      setCategories(prev => [...prev, trimmedName].sort());
      setCategoryColors(prev => ({ ...prev, [trimmedName]: uniqueColor }));
      console.log(`✅ Created category "${trimmedName}" with unique color ${uniqueColor}`);
    }
  };

  const deleteCategory = (categoryName: string) => {
    setCategories(prev => prev.filter(cat => cat !== categoryName));
    setCategoryColors(prev => {
      const { [categoryName]: _, ...rest } = prev;
      return rest;
    });
    
    // Remove category from all windows
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.group === categoryName
          ? { ...w, group: undefined, groupColor: undefined }
          : w
      )
    }));

    console.log(`✅ Deleted category "${categoryName}" and removed from all windows`);
  };

  const getAllCategories = (): string[] => {
    return [...categories];
  };

  const assignWindowToCategory = (windowId: string, categoryName: string) => {
    if (!categories.includes(categoryName)) {
      console.warn(`Category "${categoryName}" does not exist. Create it first.`);
      return;
    }

    const groupColor = categoryColors[categoryName] || getGroupColor(categoryName, categories, categoryColors);
    
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, group: categoryName, groupColor }
          : w
      )
    }));

    console.log(`✅ Assigned window ${windowId} to category "${categoryName}" with color ${groupColor}`);
  };

  const removeWindowFromCategory = (windowId: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        w.id === windowId
          ? { ...w, group: undefined, groupColor: undefined }
          : w
      )
    }));

    console.log(`✅ Removed window ${windowId} from its category`);
  };

  // Keep for backward compatibility
  const getAvailableGroups = (): string[] => {
    const groups = new Set<string>();
    state.windows.forEach(window => {
      if (window.group) {
        groups.add(window.group);
      }
    });
    return Array.from(groups).sort();
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

    // Call the click handler if provided (for assignment mode)
    if (onWindowClick) {
      onWindowClick(windowId);
    }

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
    organizeWindows,
    createCategory,
    deleteCategory,
    getAllCategories,
    assignWindowToCategory,
    removeWindowFromCategory,
    getAvailableGroups
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
            group={window.group}
            groupColor={window.groupColor}
          >
            <WindowComponent />
          </Window>
        );
      })}
    </div>
  );
});