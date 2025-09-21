'use client';

import { aiManager } from '@/ai';

export function AIWindow() {
  const handleTestAI = () => {
    aiManager.generateResponse({ prompt: 'Test prompt from AI Window!' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-600/30 bg-gray-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">AI Manager</h3>
            <p className="text-xs text-gray-300">
              Generate intelligent responses using AI processing capabilities
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <div className="w-8 h-8 bg-white rounded-lg opacity-90"></div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-2xl p-6 border border-gray-600/30">
            <button
              onClick={handleTestAI}
              className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              🤖 Test AI Response
            </button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-300">Check console for AI output</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-600/30 bg-gray-800/30 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>AI System</span>
        <span>Cerebras</span>
      </div>
    </div>
  );
}