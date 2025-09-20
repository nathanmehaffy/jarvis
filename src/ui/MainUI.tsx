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
  const [apiBudget, setApiBudget] = useState<{ used: number; nextMs: number | null }>({ used: 0, nextMs: null });
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [minimizedWindows, setMinimizedWindows] = useState<Set<string>>(new Set());
  const [isImageDropMinimized, setIsImageDropMinimized] = useState(false);
  const [isDesktopMinimized, setIsDesktopMinimized] = useState(false);
  const [showDebugSidebar, setShowDebugSidebar] = useState(false);

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
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 400,
      height: 300
    });
  };

  const openAIWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'ai-window',
      title: 'AI Manager',
      component: AIWindow,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 400,
      height: 300
    });
  };

  const openUserNotesWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'user-notes-window',
      title: 'Personal Notes',
      component: UserNotes,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 500,
      height: 400
    });
  };

  const openSystemOutputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'system-output-window',
      title: 'System Output',
      component: SystemOutput,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 600,
      height: 450
    });
  };

  const findOptimalWindowPosition = (windowWidth: number, windowHeight: number) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const padding = 20;
    const minGap = 10;
    
    const existingWindows = windowManagerRef.current?.getWindows?.() || [];
    
    const isPositionAvailable = (x: number, y: number) => {
      if (x + windowWidth > screenWidth - padding || y + windowHeight > screenHeight - padding) {
        return false;
      }
      
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
    
    for (let y = padding; y + windowHeight <= screenHeight - padding; y += 10) {
      for (let x = padding; x + windowWidth <= screenWidth - padding; x += 10) {
        if (isPositionAvailable(x, y)) {
          return { x, y };
        }
      }
    }
    
    return {
      x: Math.max(padding, (screenWidth - windowWidth) / 2),
      y: Math.max(padding, (screenHeight - windowHeight) / 2)
    };
  };

  const openImageViewerWindow = (imageUrl: string, imageName: string) => {
    const windowId = `image-viewer-${Date.now()}`;

    const img = new Image();
    img.onload = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const maxWidth = (screenWidth * 2) / 5;
      const maxHeight = (screenHeight * 2) / 5;

      const aspectRatio = img.width / img.height;

      let width, height;

      if (aspectRatio > 1) {
        width = maxWidth;
        height = width / aspectRatio;

        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
      } else {
        height = maxHeight;
        width = height * aspectRatio;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }
      }

      width = Math.max(width, 300);
      height = Math.max(height, 200);

      const position = findOptimalWindowPosition(Math.round(width), Math.round(height));

      windowManagerRef.current?.openWindow({
        id: windowId,
        title: `Image: ${imageName}`,
        component: () => <ImageViewer imageUrl={imageUrl} imageName={imageName} windowId={windowId} />,
        x: position.x,
        y: position.y,
        width: Math.round(width),
        height: Math.round(height),
        imageUrl: imageUrl,
        isMinimized: false,
        isFullscreen: false
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
      }, index * 100);
    });
  };

  const openGraphWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'graph-window',
      title: 'Line Graph',
      component: GraphWindow,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 750,
      height: 550
    });
  };

  const openBarGraphWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'bar-graph-window',
      title: 'Bar Graph',
      component: BarGraphWindow,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 750,
      height: 550
    });
  };

  const openPieChartWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'pie-chart-window',
      title: 'Pie Chart',
      component: PieChartWindow,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 800,
      height: 600
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
         
        {/* Image Drop Zone - Fixed Position */}
        <div className="fixed top-4 right-4 z-50">
          {isImageDropMinimized ? (
            /* Collapsed - Circular Icon */
            <button
              onClick={() => setIsImageDropMinimized(false)}
              className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 group"
              title="Open Image Upload"
            >
              <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>
          ) : (
            /* Expanded - Full Drop Zone */
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl text-white shadow-2xl w-64 transition-all duration-300">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-lg font-semibold break-words">Image Upload</h2>
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
                <div className="px-6 pb-6">
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