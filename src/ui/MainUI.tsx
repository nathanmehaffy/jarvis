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
      eventBus.on('ai:error', () => setAiStatus('error'))
    ];
    return () => { unsubs.forEach(u => u()); };
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
        <VoiceTaskListener />
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
        <div className="absolute bottom-6 right-6 z-10">
          <ImageDropZone onImageUpload={handleImageUpload} />
        </div>
      </WindowManager>
    </div>
  );
}
