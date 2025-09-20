'use client';

import { useEffect, useRef } from 'react';
import { eventBus } from '@/lib/eventBus';
import { inputManager } from '@/input';
import { aiManager } from '@/ai';
import { WindowManager, WindowManagerRef } from './components/windowManager';
import { InputWindow } from './components/inputWindow';
import { AIWindow } from './components/aiWindow';
import { TextOutput } from './components/textOutput';
import { AnimatedBackground } from './components/background';

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

  const openTextOutputWindow = () => {
    windowManagerRef.current?.openWindow({
      id: 'text-output-window',
      title: 'Text Output',
      component: TextOutput,
      x: 300,
      y: 200,
      width: 600,
      height: 450
    });
  };

  return (
    <div className="min-h-screen">
      <WindowManager ref={windowManagerRef}>
        <AnimatedBackground />
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
                onClick={openTextOutputWindow}
                className="group block w-full px-6 py-4 bg-gradient-to-r from-slate-500/60 to-gray-600/60 hover:from-slate-500/80 hover:to-gray-600/80 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-slate-400 rounded-full mr-3 group-hover:animate-pulse"></div>
                  <span className="font-semibold">Open Text Output</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </WindowManager>
    </div>
  );
}