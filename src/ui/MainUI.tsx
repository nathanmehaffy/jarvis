'use client';

import { useEffect, useRef } from 'react';
import { eventBus } from '@/lib/eventBus';
import { inputManager } from '@/input';
import { aiManager } from '@/ai';
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

export function MainUI() {
  const windowManagerRef = useRef<WindowManagerRef>(null);

  useEffect(() => {
    const initializeManagers = async () => {
      await Promise.all([
        inputManager.initialize(),
        aiManager.initialize()
      ]);
    };

    initializeManagers();

    const unsubscribers = [
      eventBus.on('input:initialized', () => console.log('Input manager initialized')),
      eventBus.on('ai:initialized', () => console.log('AI manager initialized')),
      eventBus.on('input:input_processed', (data) => console.log('Input processed:', data)),
      eventBus.on('ai:ai_response_generated', (data) => console.log('AI response:', data))
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
      inputManager.destroy();
      aiManager.destroy();
    };
  }, []);

  const openInputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'input-window',
      title: 'Input Manager',
      component: InputWindow,
      x: 100,
      y: 100,
      width: 400,
      height: 300
    });
  };

  const openAIWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'ai-window',
      title: 'AI Manager',
      component: AIWindow,
      x: 200,
      y: 150,
      width: 400,
      height: 300
    });
  };

  const openUserNotesWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'user-notes-window',
      title: 'Personal Notes',
      component: UserNotes,
      x: 300,
      y: 200,
      width: 500,
      height: 400
    });
  };

  const openSystemOutputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'system-output-window',
      title: 'System Output',
      component: SystemOutput,
      x: 350,
      y: 250,
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
      x: 400,
      y: 300,
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
      x: 400,
      y: 100,
      width: 750,
      height: 550
    });
  };

  const openBarGraphWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'bar-graph-window',
      title: 'Bar Graph',
      component: BarGraphWindow,
      x: 450,
      y: 150,
      width: 750,
      height: 550
    });
  };

  const openPieChartWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'pie-chart-window',
      title: 'Pie Chart',
      component: PieChartWindow,
      x: 500,
      y: 200,
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
        
        {/* Image Drop Zone - Right Side */}
        <div className="absolute top-6 right-6 z-10">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 text-white shadow-2xl mb-6 w-64">
            <h2 className="text-lg font-semibold mb-4 text-center break-words">Image Upload</h2>
            <ImageDropZone onImageUpload={handleImageUpload} />
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
              <button
                onClick={openInputWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-blue-500/60 to-indigo-600/60 hover:from-blue-500/80 hover:to-indigo-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Input Window</span>
                </div>
              </button>
              <button
                onClick={openAIWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-emerald-500/60 to-green-600/60 hover:from-emerald-500/80 hover:to-green-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open AI Window</span>
                </div>
              </button>
              <button
                onClick={openUserNotesWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-blue-500/60 to-indigo-600/60 hover:from-blue-500/80 hover:to-indigo-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Personal Notes</span>
                </div>
              </button>
              <button
                onClick={openSystemOutputWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-green-500/60 to-emerald-600/60 hover:from-green-500/80 hover:to-emerald-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open System Output</span>
                </div>
              </button>
              <button
                onClick={openGraphWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-purple-500/60 to-pink-600/60 hover:from-purple-500/80 hover:to-pink-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Line Graph</span>
                </div>
              </button>
              <button
                onClick={openBarGraphWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-orange-500/60 to-red-600/60 hover:from-orange-500/80 hover:to-red-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Bar Graph</span>
                </div>
              </button>
              <button
                onClick={openPieChartWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-pink-500/60 to-purple-600/60 hover:from-pink-500/80 hover:to-purple-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-pink-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Pie Chart</span>
                </div>
              </button>
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