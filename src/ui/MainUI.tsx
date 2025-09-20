'use client';

import { useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';
import { inputManager } from '@/input';
import { aiManager } from '@/ai';

export function MainUI() {
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

  const handleTestInput = () => {
    inputManager.processInput({ test: 'Hello World' });
  };

  const handleTestAI = () => {
    aiManager.generateResponse({ prompt: 'Test prompt' });
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-8">Jarvis - Event Bus Architecture</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Input Component</h2>
          <button 
            onClick={handleTestInput}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Input Processing
          </button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">AI Component</h2>
          <button 
            onClick={handleTestAI}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test AI Response
          </button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">UI Components</h2>
          <p className="text-gray-600">Component modules will be added to src/ui/components/</p>
        </div>
      </div>
    </div>
  );
}