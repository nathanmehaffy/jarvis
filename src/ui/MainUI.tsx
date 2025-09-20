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

//

export function MainUI() {
  const windowManagerRef = useRef<WindowManagerRef>(null);
  const [inputStatus, setInputStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [apiBudget, setApiBudget] = useState<{ used: number; nextMs: number | null }>({ used: 0, nextMs: null });
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [minimizedWindows, setMinimizedWindows] = useState<Set<string>>(new Set());
  useEffect(() => {
    aiManager.initialize();
    inputManager.initialize();

    const unsubs = [
      eventBus.on('input:initialized', () => setInputStatus('idle')),
      eventBus.on('speech:started', () => setInputStatus('listening')),
      eventBus.on('speech:ended', () => setInputStatus('idle')),
      eventBus.on('input:voice_debug', (d: any) => {
        setInputStatus((d?.status as any) || 'idle');
        setApiBudget({ used: d?.apiCallsUsedLastMinute ?? 0, nextMs: d?.nextCallInMs ?? null });
      }),
      eventBus.on('ai:initialized', () => setAiStatus('ready')),
      eventBus.on('ai:processing', () => setAiStatus('processing')),
      eventBus.on('ai:ai_tasks_executed', () => setAiStatus('ready')),
      eventBus.on('ai:text_command_processed', () => setAiStatus('ready')),
      eventBus.on('ai:ai_response_generated', () => setAiStatus('ready')),
      eventBus.on('ai:error', () => setAiStatus('error')),
      eventBus.on('window:opened', (data: any) => {
        if (data?.id) {
          setOpenWindows(prev => new Set([...prev, data.id]));
        }
      }),
      eventBus.on('window:closed', (data: any) => {
        if (data?.windowId) {
          setOpenWindows(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.windowId);
            return newSet;
          });
          setMinimizedWindows(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.windowId);
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

  const openImageViewerWindow = (imageUrl: string, imageName: string) => {
    const windowId = `image-viewer-${Date.now()}`;
    windowManagerRef.current?.openWindow({
      id: windowId,
      title: `Image: ${imageName}`,
      component: () => <ImageViewer imageUrl={imageUrl} imageName={imageName} />,
      isMinimized: false,
      isFullscreen: false,
      x: 0,
      y: 0,
      width: 700,
      height: 500
    });
  };

  const handleImageUpload = (imageUrl: string, imageName: string) => {
    openImageViewerWindow(imageUrl, imageName);
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
      <WindowManager ref={windowManagerRef}>
        <AnimatedBackground />
        {/* Voice listener */}
        <VoiceTaskListener />
        
        {/* Image Drop Zone - Right Side */}
        <div className="absolute top-6 right-6 z-10">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 text-white shadow-2xl mb-6 w-64">
            <h2 className="text-lg font-semibold mb-4 text-center break-words">Image Upload</h2>
            <ImageDropZone onImageUpload={handleImageUpload} />
          </div>

          {/* Debug indicators */}
          <div className="space-y-2">
            <div className="px-3 py-2 rounded-xl bg-black/40 text-xs">
              <div className="flex items-center justify-between">
                <span className="mr-2">Input</span>
                <span className={`px-2 py-0.5 rounded ${inputStatus === 'listening' ? 'bg-red-500' : inputStatus === 'processing' ? 'bg-yellow-500' : inputStatus === 'error' ? 'bg-rose-600' : 'bg-gray-500'}`}>{inputStatus}</span>
              </div>
              <div className="mt-1 text-[10px] text-white/80">API/min: {apiBudget.used}{apiBudget.nextMs != null ? ` • next ${Math.max(0, Math.round(apiBudget.nextMs/1000))}s` : ''}</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/40 text-xs">
              <div className="flex items-center justify-between">
                <span className="mr-2">AI</span>
                <span className={`px-2 py-0.5 rounded ${aiStatus === 'processing' ? 'bg-yellow-500' : aiStatus === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{aiStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Content */}
        <div className="absolute top-6 left-6 z-10">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-white shadow-2xl">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl mr-3 flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Jarvis Desktop
              </h1>
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
        </div>
      </WindowManager>
    </div>
  );
}