'use client';

import { useEffect, useRef, useState } from 'react';
import { aiManager } from '@/ai';
import { inputManager, VoiceTaskListener } from '@/input';
import { eventBus } from '@/lib/eventBus';
import { WindowManager, WindowManagerRef } from './components/windowManager';
import { InputWindow } from './components/inputWindow';
import { AIWindow } from './components/aiWindow';
import { UserNotes } from './components/userNotes';
import { SystemOutput } from './components/systemOutput';
import { GraphWindow } from './components/graphWindow';
import { BarGraphWindow } from './components/barGraphWindow';
import { PieChartWindow } from './components/pieChart';
import { AnimatedBackground } from './components/background';
import { ImageDropZone } from './components/imageDropZone';
import { ImageViewer } from './components/imageViewer';
import { DebugSidebar } from './components/debugSidebar';

// Color palette for groups (shared with WindowManager)
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
    if (existingColorMap[cat]) {
      usedColors.add(existingColorMap[cat]);
      return;
    }
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

export function MainUI() {
  const windowManagerRef = useRef<WindowManagerRef>(null);
  const [inputStatus, setInputStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [apiBudget, setApiBudget] = useState<{ used: number; nextMs: number | null }>({ used: 0, nextMs: null });
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [minimizedWindows, setMinimizedWindows] = useState<Set<string>>(new Set());
  const [isImageDropMinimized, setIsImageDropMinimized] = useState(false);
  const [isDesktopMinimized, setIsDesktopMinimized] = useState(false);
  const [showDebugSidebar, setShowDebugSidebar] = useState(false);
  // Category Organizer state
  const [isCategoryOrganizerOpen, setIsCategoryOrganizerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [isCategoriesPanelCollapsed, setIsCategoriesPanelCollapsed] = useState(false);
  
  // Category Assigner state  
  const [isAssignmentMode, setIsAssignmentMode] = useState(false);
  const [selectedCategoryForAssignment, setSelectedCategoryForAssignment] = useState<string | null>(null);

  useEffect(() => {
    aiManager.initialize();
    inputManager.initialize();

    const unsubs = [
      eventBus.on('input:initialized', () => setInputStatus('idle')),
      eventBus.on('speech:started', () => setInputStatus('listening')),
      eventBus.on('speech:ended', () => setInputStatus('idle')),
      eventBus.on('input:voice_debug', (d: { status?: string; apiCallsUsedLastMinute?: number; nextCallInMs?: number }) => {
        setInputStatus((d?.status as 'idle' | 'listening' | 'processing' | 'error') || 'idle');
        setApiBudget({ used: d?.apiCallsUsedLastMinute ?? 0, nextMs: d?.nextCallInMs ?? null });
      }),
      eventBus.on('ai:initialized', () => setAiStatus('ready')),
      eventBus.on('ai:processing', () => setAiStatus('processing')),
      eventBus.on('ai:ai_tasks_executed', () => setAiStatus('ready')),
      eventBus.on('ai:text_command_processed', () => setAiStatus('ready')),
      eventBus.on('ai:ai_response_generated', () => setAiStatus('ready')),
      eventBus.on('ai:error', () => setAiStatus('error')),
      eventBus.on('ui:organize_windows', () => {
        console.log('[MainUI] Organize windows command received from voice');
        setTimeout(() => {
          windowManagerRef.current?.organizeWindows();
        }, 0);
      }),
      eventBus.on('window:opened', (data: { id?: string }) => {
        if (typeof data?.id === 'string') {
          setOpenWindows(prev => new Set<string>([...prev, data.id as string]));
        }
      }),
      eventBus.on('window:closed', (data: { windowId?: string }) => {
        if (typeof data?.windowId === 'string') {
          const id = data.windowId as string;
          setOpenWindows(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          setMinimizedWindows(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          // Update categories when windows are closed
          setTimeout(updateAllCategories, 100);
        }
      })
    ];
    return () => { unsubs.forEach(u => u()); };
  }, []);

  const toggleMinimize = (windowId: string) => {
    const isMinimized = minimizedWindows.has(windowId);
    if (isMinimized) {
      windowManagerRef.current?.restoreWindow(windowId);
      setMinimizedWindows(prev => {
        const newSet = new Set(prev);
        newSet.delete(windowId);
        return newSet;
      });
    } else {
      windowManagerRef.current?.minimizeWindow(windowId);
      setMinimizedWindows(prev => new Set([...prev, windowId]));
    }
  };

  const openInputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'input-window',
      title: 'Input Manager',
      component: InputWindow,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 500,
      height: 400
    });
  };

  const openAIWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'ai-window',
      title: 'AI Manager',
      component: AIWindow,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 500,
      height: 400
    });
  };

  const openUserNotesWindow = () => {
    const windowId = `user-notes-window-${Date.now()}`;
    windowManagerRef.current?.openWindow({
      id: windowId,
      title: 'New Note',
      component: () => <UserNotes windowId={windowId} />,
      content: 'This is a new note',
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 600,
      height: 320
    });
  };

  const openSystemOutputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'system-output-window',
      title: 'System Output',
      component: SystemOutput,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 700,
      height: 350
    });
  };

  const findOptimalWindowPosition = (windowWidth: number, windowHeight: number) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const padding = 20;
    const minGap = 40;
    
    // Simple restriction: right edge cannot exceed 95% to the left (5% reserved for image drop)
    const maxRightEdge = screenWidth * 0.95;
    const maxAllowedX = maxRightEdge - windowWidth;
    
    const existingWindows = windowManagerRef.current?.getWindows?.() || [];
    
    const isPositionAvailable = (x: number, y: number) => {
      // Check if window would go off screen
      if (x + windowWidth > screenWidth - padding || y + windowHeight > screenHeight - padding) {
        return false;
      }
      
      // Check if right edge exceeds 95% restriction
      if (x + windowWidth > maxRightEdge) {
        return false;
      }
      
      // Check for overlaps with existing windows
      return !existingWindows.some(window => {
        const windowX = window.x || 0;
        const windowY = window.y || 0;
        const windowW = window.width || 0;
        const windowH = window.height || 0;
        
        return !(x >= windowX + windowW + minGap || 
                x + windowWidth <= windowX - minGap || 
                y >= windowY + windowH + minGap || 
                y + windowHeight <= windowY - minGap);
      });
    };
    
    // STRICT TOP-LEFT PRIORITY: Scan from top-left, row by row
    for (let y = padding; y + windowHeight <= screenHeight - padding; y += 15) {
      for (let x = padding; x <= maxAllowedX; x += 15) {
        if (isPositionAvailable(x, y)) {
          return { x, y };
        }
      }
    }
    
    // Fallback to top-left if no space found (instead of center)
    return {
      x: padding,
      y: padding
    };
  };

  const openImageViewerWindow = (imageUrl: string, imageName: string) => {
    const windowId = `image-viewer-${Date.now()}`;

    const img = new Image();
    img.onload = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const aspectRatio = img.width / img.height;
      
      // Get existing windows to determine if this is the first or subsequent
      const existingWindows = windowManagerRef.current?.getWindows?.() || [];
      const isFirstWindow = existingWindows.length === 0;
      
      let width, height;
      
        // All windows: Use area-based constraints only
        const screenArea = screenWidth * screenHeight;
        const minArea = screenArea * 0.1; // 10% of screen area
        const maxArea = screenArea * 0.25; // 25% of screen area
        
        let targetArea;
        if (isFirstWindow) {
          // First window: Use maximum area (no packing logic needed)
          targetArea = maxArea;
        } else {
          // Subsequent windows: Calculate optimal packing area by analyzing available space
          const padding = 20;
          const minGap = 40;
          const availableWidth = screenWidth * 0.95 - padding * 2; // 95% minus padding
          const availableHeight = screenHeight - padding * 2;
          
          // Find the largest available rectangular area for optimal packing
          let bestFitArea = minArea; // Start with minimum
          let bestWidth = 0;
          let bestHeight = 0;
          
          // Test different sizes within the min/max area constraints, starting from max and working down
          for (let testArea = maxArea; testArea >= minArea; testArea -= (maxArea - minArea) / 20) {
            // Calculate dimensions for this test area maintaining aspect ratio
            let testWidth, testHeight;
            if (aspectRatio > 1) {
              testWidth = Math.sqrt(testArea * aspectRatio);
              testHeight = Math.sqrt(testArea / aspectRatio);
            } else {
              testHeight = Math.sqrt(testArea / aspectRatio);
              testWidth = Math.sqrt(testArea * aspectRatio);
            }
            
            // Check if this size can fit in available space with optimal positioning
            let canFit = false;
            
            // Try positions starting from top-left, scanning systematically (prioritize top-left and tight packing)
            let bestPosition = null;
            let bestScore = Infinity; // Lower score = better position (closer to existing windows)
            
            for (let y = padding; y + testHeight + padding <= screenHeight; y += 15) {
              for (let x = padding; x + testWidth + padding <= availableWidth + padding * 2; x += 15) {
                // Check if this position overlaps with existing windows
                const wouldOverlap = existingWindows.some(win => {
                  const winLeft = win.x || 0;
                  const winTop = win.y || 0;
                  const winRight = winLeft + (win.width || 0);
                  const winBottom = winTop + (win.height || 0);
                  
                  return !(x >= winRight + minGap || 
                          x + testWidth <= winLeft - minGap || 
                          y >= winBottom + minGap || 
                          y + testHeight <= winTop - minGap);
                });
                
                if (!wouldOverlap) {
                  // Calculate a score for this position (prioritize tight packing)
                  let score = 0;
                  
                  // Primary score: distance from top-left (prioritize top-left)
                  score += (x - padding) * 0.1 + (y - padding) * 0.1;
                  
                  // Secondary score: distance to nearest existing window (prioritize tight packing)
                  if (existingWindows.length > 0) {
                    const minDistanceToWindow = Math.min(...existingWindows.map(win => {
                      const winCenterX = (win.x || 0) + (win.width || 0) / 2;
                      const winCenterY = (win.y || 0) + (win.height || 0) / 2;
                      const testCenterX = x + testWidth / 2;
                      const testCenterY = y + testHeight / 2;
                      return Math.sqrt(Math.pow(testCenterX - winCenterX, 2) + Math.pow(testCenterY - winCenterY, 2));
                    }));
                    score += minDistanceToWindow * 0.5; // Penalize positions far from existing windows
                  }
                  
                  // Check for adjacent placement bonus (reward positions next to existing windows)
                  const isAdjacentToWindow = existingWindows.some(win => {
                    const winLeft = win.x || 0;
                    const winTop = win.y || 0;
                    const winRight = winLeft + (win.width || 0);
                    const winBottom = winTop + (win.height || 0);
                    
                    // Check if this position is adjacent (within minGap) to any existing window
                    return (
                      // Adjacent horizontally
                      (Math.abs(x - winRight) <= minGap + 5 && !(y + testHeight <= winTop || y >= winBottom)) ||
                      (Math.abs(x + testWidth - winLeft) <= minGap + 5 && !(y + testHeight <= winTop || y >= winBottom)) ||
                      // Adjacent vertically  
                      (Math.abs(y - winBottom) <= minGap + 5 && !(x + testWidth <= winLeft || x >= winRight)) ||
                      (Math.abs(y + testHeight - winTop) <= minGap + 5 && !(x + testWidth <= winLeft || x >= winRight))
                    );
                  });
                  
                  if (isAdjacentToWindow) {
                    score -= 100; // Big bonus for adjacent placement
                  }
                  
                  if (score < bestScore) {
                    bestScore = score;
                    bestPosition = { x, y };
                  }
                  
                  canFit = true;
                }
              }
            }
            
            // Use the best position found (if any)
            if (bestPosition) {
              canFit = true;
            }
            
            // If this size fits and is larger than our current best, use it
            if (canFit && testArea > bestFitArea) {
              bestFitArea = testArea;
              bestWidth = testWidth;
              bestHeight = testHeight;
              // Since we're testing from largest to smallest, first fit is optimal
              break;
            }
          }
          
          // Use the optimal fit area, or fall back to minimum if nothing fits well
          targetArea = bestFitArea;
        }
        
        // Calculate dimensions from target area while maintaining aspect ratio
        if (aspectRatio > 1) {
          // Landscape: width = sqrt(area * aspectRatio), height = sqrt(area / aspectRatio)
          width = Math.sqrt(targetArea * aspectRatio);
          height = Math.sqrt(targetArea / aspectRatio);
        } else {
          // Portrait: height = sqrt(area / aspectRatio), width = sqrt(area * aspectRatio)
          height = Math.sqrt(targetArea / aspectRatio);
          width = Math.sqrt(targetArea * aspectRatio);
        }
        
        // Ensure the area is within bounds
        const currentArea = width * height;
        if (currentArea < minArea) {
          // Scale up to minimum area
          const scaleFactor = Math.sqrt(minArea / currentArea);
          width *= scaleFactor;
          height *= scaleFactor;
        } else if (currentArea > maxArea) {
          // Scale down to maximum area
          const scaleFactor = Math.sqrt(maxArea / currentArea);
          width *= scaleFactor;
          height *= scaleFactor;
        }
        
        // Ensure we don't exceed screen bounds (fallback protection)
        const maxScreenWidth = screenWidth * 0.95;
        const maxScreenHeight = screenHeight;
        if (width > maxScreenWidth) {
          width = maxScreenWidth;
          height = width / aspectRatio;
          // Recalculate to ensure we stay within area bounds
          const newArea = width * height;
          if (newArea > maxArea) {
            const areaScaleFactor = Math.sqrt(maxArea / newArea);
            width *= areaScaleFactor;
            height *= areaScaleFactor;
          }
        }
        if (height > maxScreenHeight) {
          height = maxScreenHeight;
          width = height * aspectRatio;
          // Recalculate to ensure we stay within area bounds
          const newArea = width * height;
          if (newArea > maxArea) {
            const areaScaleFactor = Math.sqrt(maxArea / newArea);
            width *= areaScaleFactor;
            height *= areaScaleFactor;
          }
        }

      const position = findOptimalWindowPosition(Math.round(width), Math.round(height));

    windowManagerRef.current?.openWindow({
      id: windowId,
      title: `Image: ${imageName}`,
        component: () => <ImageViewer imageUrl={imageUrl} imageName={imageName} windowId={windowId} />,
        isFullscreen: false,
        isMinimized: false,
        x: position.x,
        y: position.y,
        width: Math.round(width),
        height: Math.round(height),
        imageUrl: imageUrl
      });
    };
    img.src = imageUrl;
  };

  const handleImageUpload = (imageUrl: string, imageName: string) => {
    openImageViewerWindow(imageUrl, imageName);
  };

  const handleMultipleImageUpload = (images: { url: string; name: string }[]) => {
    images.forEach((image, index) => {
      setTimeout(() => {
        openImageViewerWindow(image.url, image.name);
      }, index * 150);
    });
  };

  const openGraphWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'graph-window',
      title: 'Line Graph',
      component: GraphWindow,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 850,
      height: 650
    });
  };

  const openBarGraphWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'bar-graph-window',
      title: 'Bar Graph',
      component: BarGraphWindow,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 850,
      height: 650
    });
  };

  const openPieChartWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'pie-chart-window',
      title: 'Pie Chart',
      component: PieChartWindow,
      isFullscreen: false,
      isMinimized: false,
      x: 0,
      y: 0,
      width: 900,
      height: 700
    });
  };

  const openPreloadedImageWindow = () => {
    const preloadedImageUrl = 'https://picsum.photos/600/400?random=1';
    const imageName = 'Sample Image';
    openImageViewerWindow(preloadedImageUrl, imageName);
  };

  const testResizingFeatures = () => {
    // Test with different aspect ratio images
    const testImages = [
      { url: 'https://picsum.photos/800/400?random=1', name: 'Wide Image (2:1 ratio)' },
      { url: 'https://picsum.photos/400/600?random=2', name: 'Tall Image (2:3 ratio)' },
      { url: 'https://picsum.photos/500/500?random=3', name: 'Square Image (1:1 ratio)' },
      { url: 'https://picsum.photos/1200/300?random=4', name: 'Ultra-wide Image (4:1 ratio)' }
    ];

    // Open multiple images with different aspect ratios
    testImages.forEach((img, index) => {
      setTimeout(() => {
        openImageViewerWindow(img.url, img.name);
      }, index * 200); // Stagger the opening
    });

    // Show instructions
    eventBus.emit('system:output', {
      text: `# 🎯 **4-Corner Resizing Test**

## ✨ **Test Instructions:**

### **What to Test:**
1. **4-Corner Resize Handles** - Hover over any corner of an image window
2. **Aspect Ratio Lock** - Resize from corners and watch the image maintain proportions
3. **Edge Resizing** - Try resizing from edges (top, bottom, left, right)
4. **Different Ratios** - Test with wide, tall, square, and ultra-wide images

### **Expected Behavior:**
- ✅ **Corner resize**: Maintains **aspect ratio** perfectly
- ✅ **Edge resize**: Also maintains **aspect ratio** 
- ✅ **Smooth operation**: No jumping or glitching
- ✅ **Position stability**: Window stays in place during resize

### **How to Resize:**
1. **Hover** over any **corner** of an image window
2. **Click and drag** to resize
3. **Notice** how the image **maintains its proportions**
4. **Try all 4 corners**: Top-left, top-right, bottom-left, bottom-right

### **Test Images Opened:**
- 🖼️ **Wide Image** (2:1 aspect ratio)
- 🖼️ **Tall Image** (2:3 aspect ratio)  
- 🖼️ **Square Image** (1:1 aspect ratio)
- 🖼️ **Ultra-wide Image** (4:1 aspect ratio)

**Perfect aspect ratio preservation on all corners!** 🎉`
    });
  };

  // Category Organizer functions
  const updateAllCategories = () => {
    const categories = windowManagerRef.current?.getAllCategories?.() || [];
    setAllCategories(categories);
    // Recompute color map locally to match WindowManager's logic
    const colors: Record<string, string> = {};
    categories.forEach(cat => {
      colors[cat] = getGroupColor(cat, categories, colors);
    });
    setCategoryColors(colors);
  };

  const createNewCategory = () => {
    if (newCategoryName.trim()) {
      const categoryName = newCategoryName.trim();
      windowManagerRef.current?.createCategory(categoryName);
      
      // Immediately update local state
      setAllCategories(prev => [...prev, categoryName].sort());
      setCategoryColors(prev => ({ ...prev, [categoryName]: getGroupColor(categoryName, allCategories, prev) }));
      setNewCategoryName('');
      
      eventBus.emit('system:output', {
        text: `✅ **Created category "${categoryName}"**!\n\nCategory now appears in the color key with its assigned color.`
      });
    }
  };

  const deleteCategoryHandler = (categoryName: string) => {
    windowManagerRef.current?.deleteCategory(categoryName);
    updateAllCategories();
    
    eventBus.emit('system:output', {
      text: `🗑️ **Deleted category "${categoryName}"**!\n\nAll windows were unassigned from this category.`
    });
  };

  // Category Assignment functions
  const toggleAssignmentMode = () => {
    setIsAssignmentMode(!isAssignmentMode);
    setSelectedCategoryForAssignment(null);
  };

  const selectCategoryForAssignment = (categoryName: string) => {
    setSelectedCategoryForAssignment(categoryName);
    
    eventBus.emit('system:output', {
      text: `🎯 **Category "${categoryName}" selected**!\n\nNow click on any window to assign it to this category.`
    });
  };

  const assignWindowToSelectedCategory = (windowId: string) => {
    if (selectedCategoryForAssignment) {
      windowManagerRef.current?.assignWindowToCategory(windowId, selectedCategoryForAssignment);
      
      eventBus.emit('system:output', {
        text: `✅ **Window assigned** to "${selectedCategoryForAssignment}"!\n\nWindow now has a colored border matching the category.`
      });
    }
  };

  const testMixedWindowsOrganize = () => {
    // Create a mix of different window types to test organize function
    
    // Create 2 AI-generated windows with different sizes
    eventBus.emit('ui:open_window', {
      id: 'test-note-1',
      title: '📝 Test Note 1',
      content: `# Test Note Window

This is a **test note** window with some content.

- Item 1
- Item 2
- Item 3`,
      size: { width: 400, height: 300 }
    });

    setTimeout(() => {
      eventBus.emit('ui:open_window', {
        id: 'test-dialog-2',
        title: '💬 Test Dialog 2', 
        content: `## Dialog Window

This is a longer dialog window with more content to test different aspect ratios.

> This is a quote block
> 
> With multiple lines

\`\`\`javascript
function test() {
  return "Hello World";
}
\`\`\``,
        size: { width: 500, height: 400 }
      });
    }, 200);

    setTimeout(() => {
      eventBus.emit('ui:open_window', {
        id: 'test-wide-3',
        title: '📊 Wide Window 3',
        content: `### Wide Layout Window

| Column 1 | Column 2 | Column 3 | Column 4 |
|----------|----------|----------|----------|
| Data A   | Data B   | Data C   | Data D   |
| Data E   | Data F   | Data G   | Data H   |

This window has a **wider aspect ratio** to test mixed layouts.`,
        size: { width: 700, height: 250 }
      });
    }, 400);

    // Add system message
    eventBus.emit('system:output', {
      text: `🧪 **Mixed Window Types Created!**

Created 3 **generated windows** (will keep default size):
- **📝 Note Window** (400×300) - Standard aspect ratio
- **💬 Dialog Window** (500×400) - Slightly taller  
- **📊 Wide Window** (700×250) - Wide aspect ratio

**🎯 New Organize Behavior:**
- **Image windows** → Optimized size & smart packing
- **Generated windows** → Keep current size, smart placement (no stacking!)

**🔍 Generated Window Placement:**
1. **First**: Try to find non-overlapping positions
2. **Fallback**: Find position with minimal overlap
3. **Never**: Stack windows in same location

Try adding some **image windows** (drag & drop), then use **voice command**: *"Organize the windows"* to see the difference!`
    });
  };

  const testCategoryFeatures = () => {
    // Create several windows and categories for demonstration
    eventBus.emit('ui:open_window', {
      id: 'math-calc-1',
      title: '🧮 Calculator',
      content: `# Calculator App

This is a **math-related** window for calculations.

## Basic Operations:
- Addition: \`2 + 3 = 5\`
- Subtraction: \`10 - 4 = 6\`
- Multiplication: \`7 × 8 = 56\`

*Perfect for the "Math" group!*`,
      size: { width: 350, height: 280 }
    });

    setTimeout(() => {
      eventBus.emit('ui:open_window', {
        id: 'math-formula-2',
        title: '📐 Geometry Formulas',
        content: `# Geometry Reference

**Area Formulas:**
- Circle: \`A = πr²\`
- Rectangle: \`A = l × w\`
- Triangle: \`A = ½bh\`

**Volume Formulas:**
- Sphere: \`V = ⁴⁄₃πr³\`
- Cylinder: \`V = πr²h\`

*Another math window for grouping!*`,
        size: { width: 400, height: 350 }
      });
    }, 200);

    setTimeout(() => {
      eventBus.emit('ui:open_window', {
        id: 'reading-book-1',
        title: '📚 Book Notes',
        content: `# Reading Notes

## Current Book: "The Great Gatsby"

### Chapter 1 Summary:
- Nick Carraway moves to West Egg
- Meets his mysterious neighbor **Gatsby**
- Dinner at Tom and Daisy's house

### Key Themes:
- The American Dream
- Social class distinctions
- Love and obsession

*Perfect for the "Reading" group!*`,
        size: { width: 450, height: 400 }
      });
    }, 400);

    setTimeout(() => {
      eventBus.emit('ui:open_window', {
        id: 'reading-vocab-2',
        title: '📖 Vocabulary List',
        content: `# Vocabulary Builder

## New Words:
1. **Serendipity** - *pleasant surprise*
2. **Ephemeral** - *lasting very briefly*
3. **Quintessential** - *most perfect example*
4. **Ubiquitous** - *present everywhere*
5. **Mellifluous** - *sweet-sounding*

## Usage Examples:
> "The serendipitous meeting changed everything."

*Another reading-related window!*`,
        size: { width: 380, height: 320 }
      });
    }, 600);

    // Create sample categories
    setTimeout(() => {
      windowManagerRef.current?.createCategory("Math");
      windowManagerRef.current?.createCategory("Reading");
      updateAllCategories();
    }, 800);

    // Add system message
    eventBus.emit('system:output', {
      text: `🏷️ **Category System Demo Ready!**

Created **4 windows** + **2 categories**:
- **🧮 Calculator** + **📐 Geometry** → Ready for "Math" category
- **📚 Book Notes** + **📖 Vocabulary** → Ready for "Reading" category

## 🎯 **New 2-Step Process:**

### **Step 1: Categories Created** ✅
- **"Math"** and **"Reading"** categories auto-created
- **Color key** shows all categories with their colors

### **Step 2: Assignment Process**
1. **Click "Assign" button** (orange lightning icon)
2. **Click a category** (e.g., "Math")  
3. **Click windows** to assign them to that category
4. **Watch borders change color** instantly!

## ✨ **Key Benefits:**
- **Separate systems**: Category management vs assignment
- **Visual feedback**: Color key shows ALL categories
- **Intuitive workflow**: Click category → Click windows

*Try the new system: Categories → Assign → Click & Assign!* 🎨`
    });
  };

  const testMarkdownFeatures = () => {
    // Test system output with markdown
    eventBus.emit('system:output', {
      text: `# 🎉 **Markdown Support Enabled!**

## ✨ **Features Available:**

### **Text Formatting**
- **Bold text** with \`**bold**\`
- *Italic text* with \`*italic*\`
- ***Bold and italic*** with \`***both***\`
- \`Inline code\` with backticks

### **Code Blocks**
\`\`\`typescript
const markdown = "awesome";
console.log(\`Markdown is \${markdown}!\`);
\`\`\`

### **Lists**
1. **Ordered lists** work perfectly
2. ***With formatting*** inside
3. \`Code in lists\` too!

- ✅ **Unordered lists**
- ⚠️ *With emojis*
- 🚀 \`And code snippets\`

### **Quotes & Tables**
> **Important**: This is a blockquote with ***formatting***!

| Feature | Status | Notes |
|---------|--------|-------|
| **Bold** | ✅ | Working |
| *Italic* | ✅ | Working |
| \`Code\` | ✅ | Working |

---

## 🎯 **Try It Out:**
1. Open **User Notes** window
2. Click **👁️ Preview** button  
3. Type some markdown and see it render!

**Enjoy your enhanced Jarvis experience!** 🤖✨`
    });

    // Test dynamic window with markdown content
    eventBus.emit('ui:open_window', {
      id: 'markdown-demo',
      title: '📝 Markdown Demo Window',
      content: `# Welcome to Markdown Windows!

This is a **dynamic window** with ***full markdown support***!

## What you can do:
- Write **bold** and *italic* text
- Add \`inline code\` snippets
- Create lists and tables
- Use > blockquotes for emphasis

\`\`\`javascript
// Even code blocks work!
function sayHello() {
  console.log("Hello, Markdown World! 🌍");
}
\`\`\`

> **Pro Tip**: The UserNotes window has a preview mode toggle! ✨`,
      size: { width: 600, height: 500 }
    });
  };

  return (
    <div className="min-h-screen">
      {/* Global AI loading indicator */}
      {aiStatus === 'processing' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 text-white border border-white/10 shadow-2xl backdrop-blur">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-sm font-medium">Jarvis is thinking…</span>
          </div>
        </div>
      )}
      <WindowManager
        ref={windowManagerRef}
        onWindowsChange={(windows) => {
          aiManager.setUIContext({ windows });
        }}
        onWindowClick={isAssignmentMode && selectedCategoryForAssignment ? assignWindowToSelectedCategory : undefined}
      >
        <AnimatedBackground />
        <VoiceTaskListener />
        
        {showDebugSidebar && (
          <DebugSidebar
            inputStatus={inputStatus}
            aiStatus={aiStatus}
            apiBudget={apiBudget}
            openInputWindow={openInputWindow}
            openAIWindow={openAIWindow}
            openUserNotesWindow={openUserNotesWindow}
            openSystemOutputWindow={openSystemOutputWindow}
            openGraphWindow={openGraphWindow}
            openBarGraphWindow={openBarGraphWindow}
            openPieChartWindow={openPieChartWindow}
            openPreloadedImageWindow={openPreloadedImageWindow}
          />
         )}
          
         {/* Organize Button - Right Side Middle */}
         <button
           onClick={(e) => {
             e.preventDefault();
             e.stopPropagation();
             setTimeout(() => {
               windowManagerRef.current?.organizeWindows?.();
             }, 0);
           }}
           className={`fixed right-4 ${isImageDropMinimized ? 'top-32' : 'top-44'} z-40 w-16 h-16 bg-purple-500/30 backdrop-blur-xl border-2 border-purple-400/50 rounded-2xl text-purple-200 shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-purple-500/40 group`}
           title="Organize Windows - Maximize Area"
         >
           <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
           </svg>
           <span className="text-xs font-medium mt-1 opacity-80 group-hover:opacity-100 transition-opacity">Organize</span>
         </button>

         {/* Category Organizer Button */}
         <button
           onClick={() => setIsCategoryOrganizerOpen(!isCategoryOrganizerOpen)}
           className={`fixed right-4 ${isImageDropMinimized ? 'top-56' : 'top-64'} z-40 w-16 h-16 backdrop-blur-xl border-2 rounded-2xl shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 group ${
             isCategoryOrganizerOpen 
               ? 'bg-purple-500/40 border-purple-400/60 text-purple-200 hover:bg-purple-500/50' 
               : 'bg-blue-500/30 border-blue-400/50 text-blue-200 hover:bg-blue-500/40'
           }`}
           title="Manage Categories"
         >
           <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
           </svg>
           <span className="text-xs font-medium mt-1 opacity-80 group-hover:opacity-100 transition-opacity">Categories</span>
         </button>

         {/* Category Assigner Button */}
         {allCategories.length > 0 && (
           <button
             onClick={toggleAssignmentMode}
             className={`fixed right-4 ${isImageDropMinimized ? 'top-80' : 'top-96'} z-40 w-16 h-16 backdrop-blur-xl border-2 rounded-2xl shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 group ${
               isAssignmentMode 
                 ? 'bg-green-500/40 border-green-400/60 text-green-200 hover:bg-green-500/50' 
                 : 'bg-orange-500/30 border-orange-400/50 text-orange-200 hover:bg-orange-500/40'
             }`}
             title={isAssignmentMode ? "Exit Assignment Mode" : "Assign Windows to Categories"}
           >
             <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
             <span className="text-xs font-medium mt-1 opacity-80 group-hover:opacity-100 transition-opacity">Assign</span>
           </button>
         )}

        {/* Collapsed Category Folders are now shown inside the Category Colors panel */}

         {/* Category Organizer Panel */}
         {isCategoryOrganizerOpen && (
           <div className="fixed right-24 top-1/2 -translate-y-1/2 z-40 w-80 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl p-4">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-semibold">🏷️ Manage Categories</h3>
               <button 
                 onClick={() => setIsCategoryOrganizerOpen(false)}
                 className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
          </div>

             <div className="mb-4">
               <label className="block text-sm font-medium mb-2">Create New Category:</label>
               <div className="flex space-x-2">
                 <input
                   type="text"
                   value={newCategoryName}
                   onChange={(e) => setNewCategoryName(e.target.value)}
                   placeholder="e.g., Math, Reading, Work..."
                   className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-blue-400/50 focus:bg-white/15 transition-all"
                   onKeyPress={(e) => e.key === 'Enter' && createNewCategory()}
                 />
                 <button
                   onClick={createNewCategory}
                   disabled={!newCategoryName.trim()}
                   className="px-4 py-2 bg-blue-500/30 hover:bg-blue-500/40 disabled:bg-gray-500/20 disabled:text-gray-400 border border-blue-400/50 disabled:border-gray-600/30 rounded-lg transition-all duration-200 font-medium"
                 >
                   Add
                 </button>
               </div>
             </div>
             
            {/* Bulk actions */}
            {allCategories.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    allCategories.forEach(cat => windowManagerRef.current?.collapseCategory?.(cat));
                  }}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg transition-colors"
                >
                  Collapse All
                </button>
                <button
                  onClick={() => {
                    allCategories.forEach(cat => windowManagerRef.current?.expandCategory?.(cat));
                  }}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg transition-colors"
                >
                  Expand All
                </button>
              </div>
            )}

             <div className="mb-4">
               <label className="block text-sm font-medium mb-2">Existing Categories ({allCategories.length}):</label>
              <div className="max-h-32 overflow-y-auto space-y-2">
                 {allCategories.map((categoryName) => {
                   const categoryColor = categoryColors[categoryName] || getGroupColor(categoryName, allCategories, categoryColors);
                  const isCollapsed = windowManagerRef.current?.isCategoryCollapsed?.(categoryName) ?? false;
                   return (
                     <div key={categoryName} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded">
                       <div 
                         className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                         style={{ 
                           backgroundColor: `${categoryColor}60`,
                           borderColor: categoryColor
                         }}
                       ></div>
                       <span className="text-sm flex-1">{categoryName}</span>
                    <button
                      onClick={() => windowManagerRef.current?.collapseCategory?.(categoryName)}
                      className="text-xs px-2 py-1 rounded border text-yellow-300 border-yellow-400/40 hover:bg-yellow-500/10 transition-colors"
                      title="Collapse category windows"
                      disabled={isCollapsed}
                    >
                      Collapse
                    </button>
                    <button
                      onClick={() => windowManagerRef.current?.expandCategory?.(categoryName)}
                      className="text-xs px-2 py-1 rounded border text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/10 transition-colors"
                      title="Expand category windows"
                      disabled={!isCollapsed}
                    >
                      Expand
                    </button>
                       <button
                         onClick={() => deleteCategoryHandler(categoryName)}
                         className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-500/10 rounded"
                         title="Delete Category"
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                         </svg>
                       </button>
                     </div>
                   );
                 })}
                 {allCategories.length === 0 && (
                   <div className="text-center text-white/50 py-4">
                     No categories yet. Create one above!
                   </div>
                 )}
               </div>
             </div>
           </div>
         )}

         {/* Category Assignment Panel */}
         {isAssignmentMode && (
           <div className="fixed right-24 top-24 z-40 w-80 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl p-4">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-semibold">⚡ Assign to Category</h3>
               <button 
                 onClick={toggleAssignmentMode}
                 className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
             
             {selectedCategoryForAssignment ? (
               <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
                 <div className="flex items-center space-x-2">
                   <div 
                     className="w-4 h-4 rounded-full border-2"
                     style={{ 
                       backgroundColor: `${(selectedCategoryForAssignment ? (categoryColors[selectedCategoryForAssignment] || getGroupColor(selectedCategoryForAssignment, allCategories, categoryColors)) : '#6B7280')}60`,
                       borderColor: selectedCategoryForAssignment ? (categoryColors[selectedCategoryForAssignment] || getGroupColor(selectedCategoryForAssignment, allCategories, categoryColors)) : '#6B7280'
                     }}
                   ></div>
                   <span className="font-medium">Selected: {selectedCategoryForAssignment}</span>
                 </div>
                 <div className="text-sm text-green-200 mt-1">
                   Click on any window to assign it to this category
                 </div>
               </div>
             ) : (
               <div className="mb-4">
                 <label className="block text-sm font-medium mb-2">Select Category to Assign:</label>
                 <div className="max-h-32 overflow-y-auto space-y-2">
                   {allCategories.map((categoryName) => {
                     const categoryColor = categoryColors[categoryName] || getGroupColor(categoryName, allCategories, categoryColors);
                     return (
                       <button
                         key={categoryName}
                         onClick={() => selectCategoryForAssignment(categoryName)}
                         className="w-full flex items-center space-x-2 p-2 hover:bg-white/5 rounded transition-colors"
                       >
                         <div 
                           className="w-4 h-4 rounded-full border-2"
                           style={{ 
                             backgroundColor: `${categoryColor}60`,
                             borderColor: categoryColor
                           }}
                         ></div>
                         <span className="text-sm">{categoryName}</span>
                       </button>
                     );
                   })}
                 </div>
               </div>
             )}
           </div>
         )}

        {/* Categories Panel (compact, collapsible) */}
        {allCategories.length > 0 && (
          <div className="fixed right-4 bottom-4 z-40 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl p-3 w-72">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">📂 Categories</h4>
              <button
                onClick={() => setIsCategoriesPanelCollapsed(!isCategoriesPanelCollapsed)}
                className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title={isCategoriesPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                <svg className={`w-4 h-4 transition-transform ${isCategoriesPanelCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {!isCategoriesPanelCollapsed && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {allCategories.map((categoryName) => {
                  const categoryColor = categoryColors[categoryName] || getGroupColor(categoryName, allCategories, categoryColors);
                  const windowsInCategory = windowManagerRef.current?.getWindows?.()?.filter(w => w.group === categoryName).length || 0;
                  return (
                    <div key={categoryName} className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 shadow-sm"
                        style={{ 
                          backgroundColor: `${categoryColor}60`,
                          borderColor: categoryColor,
                          boxShadow: `0 0 6px ${categoryColor}30`
                        }}
                      ></div>
                      <div className="flex-1 truncate">
                        <span className="text-sm font-medium">{categoryName}</span>
                        <span className="text-xs text-white/60 ml-2">({windowsInCategory})</span>
                      </div>
                    </div>
                  );
                })}

                {(windowManagerRef.current?.getCollapsedCategories?.() || []).length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-xs text-white/70 mb-2">Folders</div>
                    <div className="flex flex-row flex-wrap gap-2">
                      {(windowManagerRef.current?.getCollapsedCategories?.() || []).map((cat) => {
                        const color = categoryColors[cat] || getGroupColor(cat, allCategories, categoryColors);
                        const count = windowManagerRef.current?.getWindows?.()?.filter(w => w.group === cat).length || 0;
                        return (
                          <button
                            key={cat}
                            onClick={() => windowManagerRef.current?.expandCategory?.(cat)}
                            className="px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-md text-white flex items-center gap-2 hover:bg-black/35 transition-colors"
                            title={`Expand ${cat}`}
                          >
                            <div className="w-3 h-3 rounded-full border-2" style={{ backgroundColor: `${color}60`, borderColor: color }}></div>
                            <span className="text-xs font-medium truncate max-w-[80px]">{cat}</span>
                            <span className="text-[10px] text-white/70">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

         {/* Image Drop Zone - Fixed Position */}
         <div className="fixed top-4 right-4 z-50" onClick={(e) => e.stopPropagation()}>
          {isImageDropMinimized ? (
            /* Collapsed - Circular Icon */
            <button
              onClick={() => setIsImageDropMinimized(false)}
              className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 group"
              title="Open Image Upload"
            >
              <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          ) : (
            /* Expanded - Full Drop Zone */
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl w-36 h-36 transition-all duration-300">
              <div className="flex items-center justify-between p-3 pb-1">
                <h2 className="text-sm font-semibold break-words">Upload</h2>
                <button
                  onClick={() => setIsImageDropMinimized(true)}
                  className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                  title="Collapse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
                <div className="px-6 pb-3">
                  <ImageDropZone 
                    onImageUpload={handleImageUpload} 
                    onMultipleImageUpload={handleMultipleImageUpload}
                  />
                </div>
            </div>
          )}
        </div>


        {/* Desktop Content - Hidden */}
        <div className="hidden absolute top-6 left-6 z-10">
          {isDesktopMinimized ? (
            /* Minimized - Circular Icon */
            <button
              onClick={() => setIsDesktopMinimized(false)}
              className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 group"
              title="Open Jarvis Desktop"
            >
              <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
              </div>
            </button>
          ) : (
            /* Expanded - Full Desktop */
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-white shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl mr-3 flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Jarvis Desktop
              </h1>
                </div>
                <button
                  onClick={() => setIsDesktopMinimized(true)}
                  className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                  title="Minimize"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
              <button
                onClick={openInputWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-blue-500/60 to-indigo-600/60 hover:from-blue-500/80 hover:to-indigo-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Input Window</span>
                </div>
              </button>
                {openWindows.has('input-window') && (
                  <button
                    onClick={() => toggleMinimize('input-window')}
                    className="px-3 py-4 bg-blue-500/40 hover:bg-blue-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('input-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('input-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openAIWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500/60 to-green-600/60 hover:from-emerald-500/80 hover:to-green-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open AI Window</span>
                </div>
              </button>
                {openWindows.has('ai-window') && (
                  <button
                    onClick={() => toggleMinimize('ai-window')}
                    className="px-3 py-4 bg-emerald-500/40 hover:bg-emerald-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('ai-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('ai-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openUserNotesWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-blue-500/60 to-indigo-600/60 hover:from-blue-500/80 hover:to-indigo-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Personal Notes</span>
                </div>
              </button>
                {openWindows.has('user-notes-window') && (
                  <button
                    onClick={() => toggleMinimize('user-notes-window')}
                    className="px-3 py-4 bg-blue-500/40 hover:bg-blue-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('user-notes-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('user-notes-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openSystemOutputWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-green-500/60 to-emerald-600/60 hover:from-green-500/80 hover:to-emerald-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open System Output</span>
                </div>
              </button>
                {openWindows.has('system-output-window') && (
                  <button
                    onClick={() => toggleMinimize('system-output-window')}
                    className="px-3 py-4 bg-green-500/40 hover:bg-green-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('system-output-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('system-output-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openGraphWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-purple-500/60 to-pink-600/60 hover:from-purple-500/80 hover:to-pink-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Line Graph</span>
                </div>
              </button>
                {openWindows.has('graph-window') && (
                  <button
                    onClick={() => toggleMinimize('graph-window')}
                    className="px-3 py-4 bg-purple-500/40 hover:bg-purple-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('graph-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('graph-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openBarGraphWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-orange-500/60 to-red-600/60 hover:from-orange-500/80 hover:to-red-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Bar Graph</span>
                </div>
              </button>
                {openWindows.has('bar-graph-window') && (
                  <button
                    onClick={() => toggleMinimize('bar-graph-window')}
                    className="px-3 py-4 bg-orange-500/40 hover:bg-orange-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('bar-graph-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('bar-graph-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={openPieChartWindow}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-pink-500/60 to-purple-600/60 hover:from-pink-500/80 hover:to-purple-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-pink-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Pie Chart</span>
                </div>
              </button>
                {openWindows.has('pie-chart-window') && (
                  <button
                    onClick={() => toggleMinimize('pie-chart-window')}
                    className="px-3 py-4 bg-pink-500/40 hover:bg-pink-500/60 rounded-xl transition-all duration-200 border border-white/10"
                    title={minimizedWindows.has('pie-chart-window') ? 'Restore' : 'Minimize'}
                  >
                    <span className="text-sm font-bold">{minimizedWindows.has('pie-chart-window') ? '+' : '−'}</span>
                  </button>
                )}
              </div>
              <button
                onClick={openPreloadedImageWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-teal-500/60 to-cyan-600/60 hover:from-teal-500/80 hover:to-cyan-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Sample Image</span>
                </div>
              </button>
              
              <button
                onClick={testMarkdownFeatures}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-purple-500/60 to-pink-600/60 hover:from-purple-500/80 hover:to-pink-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10 mt-4"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">🎉 Test Markdown Features</span>
            </div>
              </button>
              
              <button
                onClick={testResizingFeatures}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-orange-500/60 to-red-600/60 hover:from-orange-500/80 hover:to-red-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10 mt-4"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">🎯 Test 4-Corner Resizing</span>
          </div>
              </button>

              <button
                onClick={testMixedWindowsOrganize}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-blue-500/60 to-cyan-600/60 hover:from-blue-500/80 hover:to-cyan-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10 mt-4"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">🪟 Test Mixed Windows + Organize</span>
                </div>
              </button>

              <button
                onClick={testCategoryFeatures}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-emerald-500/60 to-teal-600/60 hover:from-emerald-500/80 hover:to-teal-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10 mt-4"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">🏷️ Test Category System + Assignment</span>
                </div>
              </button>
            </div>
            </div>
          )}
        </div>
      </WindowManager>
    </div>
  );
}