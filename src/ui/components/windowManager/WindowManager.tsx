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
  getCategoryColors: () => Record<string, string>;
  // Window assignment to categories
  assignWindowToCategory: (windowId: string, categoryName: string) => void;
  removeWindowFromCategory: (windowId: string) => void;
  getAvailableGroups: () => string[]; // Keep for backward compatibility
  collapseCategory: (categoryName: string) => void;
  expandCategory: (categoryName: string) => void;
  toggleCategoryCollapse: (categoryName: string) => void;
  isCategoryCollapsed: (categoryName: string) => boolean;
  getCollapsedCategories: () => string[];
  organizeCategory: (categoryName: string) => void;
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
    nextZIndex: 10,
    collapsedCategories: []
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

      const categoryCollapsed = (prev.collapsedCategories || []).includes(windowData.group || '');
      const newWindow = {
        ...windowData,
        title: windowData.title || inferredTitle,
        autoTitle: !windowData.title,
        x: optimalPosition.x,
        y: optimalPosition.y,
        width: size.width,
        height: size.height,
        isOpen: !categoryCollapsed,
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

  const getCategoryColors = (): Record<string, string> => {
    return { ...categoryColors };
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
          ? { ...w, group: categoryName, groupColor, isOpen: !(prev.collapsedCategories || []).includes(categoryName) }
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

  // Category collapsing/expanding
  const collapseCategory = (categoryName: string) => {
    setState(prev => {
      const collapsed = new Set(prev.collapsedCategories || []);
      collapsed.add(categoryName);
      return {
        ...prev,
        collapsedCategories: Array.from(collapsed),
        windows: prev.windows.map(w =>
          w.group === categoryName ? { ...w, isOpen: false } : w
        )
      };
    });
  };

  const expandCategory = (categoryName: string) => {
    setState(prev => {
      const collapsed = new Set(prev.collapsedCategories || []);
      collapsed.delete(categoryName);
      return {
        ...prev,
        collapsedCategories: Array.from(collapsed),
        windows: prev.windows.map(w =>
          w.group === categoryName ? { ...w, isOpen: true } : w
        )
      };
    });
  };

  const toggleCategoryCollapse = (categoryName: string) => {
    setState(prev => {
      const collapsed = new Set(prev.collapsedCategories || []);
      const willCollapse = !collapsed.has(categoryName);
      if (willCollapse) {
        collapsed.add(categoryName);
      } else {
        collapsed.delete(categoryName);
      }
      return {
        ...prev,
        collapsedCategories: Array.from(collapsed),
        windows: prev.windows.map(w =>
          w.group === categoryName ? { ...w, isOpen: !willCollapse } : w
        )
      };
    });
  };

  const isCategoryCollapsed = (categoryName: string): boolean => {
    return (state.collapsedCategories || []).includes(categoryName);
  };

  const getCollapsedCategories = (): string[] => {
    return [...(state.collapsedCategories || [])];
  };

  const organizeCategory = (categoryName: string) => {
    // Reuse organize logic scoped to one category
    const windows = state.windows.filter(w => w.group === categoryName);
    if (windows.length === 0) return;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const margin = 5;
    const maxRightEdge = viewportWidth * 0.95;
    const availableWidth = maxRightEdge - margin * 2;
    const availableHeight = viewportHeight - margin * 2;

    // Simple grid placement for the category
    const cols = Math.ceil(Math.sqrt(windows.length));
    const rows = Math.ceil(windows.length / cols);
    const cellWidth = Math.floor(availableWidth / cols) - margin * 2;
    const cellHeight = Math.floor(availableHeight / rows) - margin * 2;

    const updated: Record<string, { x: number; y: number }> = {};
    windows.forEach((w, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = margin + c * (cellWidth + margin);
      const y = margin + r * (cellHeight + margin);
      updated[w.id] = { x, y };
    });

    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w =>
        updated[w.id] ? { ...w, x: updated[w.id].x, y: updated[w.id].y } : w
      )
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
    getCategoryColors,
    assignWindowToCategory,
    removeWindowFromCategory,
    getAvailableGroups,
    collapseCategory,
    expandCategory,
    toggleCategoryCollapse,
    isCategoryCollapsed,
    getCollapsedCategories,
    organizeCategory
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
      // Category/group events from ToolExecutor or voice
      eventBus.on('window:create_group', (data: any) => {
        const name = String(data?.name || '').trim();
        const color = typeof data?.color === 'string' ? data.color : undefined;
        if (!name) return;
        const exists = categories.includes(name);
        if (!exists) {
          const c = color || getGroupColor(name, categories, categoryColors);
          setCategories(prev => [...prev, name].sort());
          setCategoryColors(prev => ({ ...prev, [name]: c }));
        }
      }),
      eventBus.on('window:assign_group', (data: any) => {
        const windowId = String(data?.windowId || '');
        const groupName = String(data?.groupName || '').trim();
        if (!windowId || !groupName) return;
        const groupColor = categoryColors[groupName] || getGroupColor(groupName, categories, categoryColors);
        if (!categories.includes(groupName)) {
          setCategories(prev => [...prev, groupName].sort());
          setCategoryColors(prev => ({ ...prev, [groupName]: groupColor }));
        }
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => w.id === windowId ? { ...w, group: groupName, groupColor } : w)
        }));
      }),
      eventBus.on('window:collapse_group', (data: any) => {
        const groupName = String(data?.groupName || '').trim();
        if (!groupName) return;
        // Hide all windows of the group and open a single summary window
        const windowsInGroup = state.windows.filter(w => w.group === groupName);
        if (windowsInGroup.length === 0) return;
        const color = categoryColors[groupName] || getGroupColor(groupName, categories, categoryColors);
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => w.group === groupName ? { ...w, isMinimized: true } : w)
        }));
        setTimeout(() => {
          openWindow({
            id: `group-${groupName}-summary`,
            title: `📁 ${groupName} (${windowsInGroup.length})`,
            content: windowsInGroup.map(w => `- ${w.title}`).join('\n'),
            component: ({ content }: { content?: string }) => (
              <div className="p-4 h-full">
                <MarkdownText className="text-sm">{String(content || '')}</MarkdownText>
              </div>
            ),
            isMinimized: false,
            isFullscreen: false,
            x: 120,
            y: 120,
            width: 420,
            height: 320,
            group: groupName,
            groupColor: color
          });
        }, 0);
      }),
      eventBus.on('window:expand_group', (data: any) => {
        const groupName = String(data?.groupName || '').trim();
        if (!groupName) return;
        // Close the summary window and restore minimized ones
        const summaryId = `group-${groupName}-summary`;
        closeWindow(summaryId);
        setState(prev => ({
          ...prev,
          windows: prev.windows.map(w => w.group === groupName ? { ...w, isMinimized: false } : w)
        }));
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
  }, [categories, categoryColors, state.windows]);

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
      {state.windows.filter(w => w.isOpen).map(window => {
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
            <WindowComponent {...(window.content !== undefined ? { content: window.content } : {})} />
          </Window>
        );
      })}
    </div>
  );
});