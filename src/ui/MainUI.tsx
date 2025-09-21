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

export function MainUI() {
  const windowManagerRef = useRef<WindowManagerRef>(null);
  const [inputStatus, setInputStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [minimizedWindows, setMinimizedWindows] = useState<Set<string>>(new Set());
  const [isImageDropMinimized, setIsImageDropMinimized] = useState(false);
  const [isDesktopMinimized, setIsDesktopMinimized] = useState(false);
  const [showDebugSidebar, setShowDebugSidebar] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    aiManager.initialize();
    inputManager.initialize();

    const unsubs = [
      eventBus.on('input:initialized', () => setInputStatus('idle')),
      eventBus.on('speech:started', () => setInputStatus('listening')),
      eventBus.on('speech:ended', () => setInputStatus('idle')),
      eventBus.on('input:voice_debug', (d: { status?: string; apiCallsUsedLastMinute?: number; nextCallInMs?: number }) => {
        setInputStatus((d?.status as 'idle' | 'listening' | 'processing' | 'error') || 'idle');
      }),
      eventBus.on('ai:initialized', () => setAiStatus('ready')),
      eventBus.on('ai:processing', () => setAiStatus('processing')),
      eventBus.on('ai:ai_tasks_executed', () => setAiStatus('ready')),
      eventBus.on('ai:text_command_processed', () => setAiStatus('ready')),
      eventBus.on('ai:ai_response_generated', () => setAiStatus('ready')),
      eventBus.on('ai:error', () => setAiStatus('error')),
      eventBus.on('ai:searching', () => setIsSearching(true)),
      eventBus.on('ai:search_complete', () => setIsSearching(false)),
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

      {/* Global search indicator */}
      {isSearching && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-blue-900/60 text-white border border-blue-400/30 shadow-2xl backdrop-blur">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-sm font-medium">Jarvis is searching…</span>
          </div>
        </div>
      )}
      <WindowManager
        ref={windowManagerRef}
        onWindowsChange={(windows) => {
          aiManager.setUIContext({ windows });
        }}
      >
        <AnimatedBackground />
        <VoiceTaskListener />

        {showDebugSidebar && (
          <DebugSidebar
            inputStatus={inputStatus}
            aiStatus={aiStatus}
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
             // Use setTimeout to ensure we're not in a render cycle
             setTimeout(() => {
               if (windowManagerRef.current?.organizeWindows) {
                 windowManagerRef.current.organizeWindows();
               }
             }, 0);
           }}
           className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-16 h-16 bg-purple-500/30 backdrop-blur-xl border-2 border-purple-400/50 rounded-2xl text-purple-200 shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-purple-500/40 group"
           title="Organize Windows - Maximize Area"
         >
           <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
           </svg>
           <span className="text-xs font-medium mt-1 opacity-80 group-hover:opacity-100 transition-opacity">Organize</span>
         </button>

         {/* Image Drop Zone - Fixed Position */}
         <div className="fixed top-4 right-4 z-50">
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

        {/* Debug toggle button - Bottom right */}
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowDebugSidebar(v => !v)}
            className="w-12 h-12 bg-black/40 hover:bg-black/60 text-white rounded-full border border-white/20 shadow-xl flex items-center justify-center transition-all duration-200"
            title={showDebugSidebar ? 'Hide Debug Sidebar' : 'Show Debug Sidebar'}
          >
            {/* Bug icon */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 13h4m10 0h4M5 17l2-2m10 2l-2-2M5 9l2 2m10-2l-2 2M12 6a5 5 0 00-5 5v4a5 5 0 0010 0v-4a5 5 0 00-5-5z" />
            </svg>
          </button>
        </div>

        {/* Desktop Content */}
        <div className="absolute top-6 left-6 z-10">
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
            </div>
            </div>
          )}
        </div>
      </WindowManager>
    </div>
  );
}