'use client';

import { aiManager } from '@/ai';

export function AIWindow() {
  const handleTestAI = () => {
    aiManager.generateResponse({ prompt: 'Test prompt from AI Window!' });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <div className="w-8 h-8 bg-white rounded-lg opacity-90"></div>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">AI Manager</h3>
        <p className="text-gray-600 leading-relaxed">Generate intelligent responses using AI processing capabilities</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-2xl p-6 border border-emerald-200/50">
        <button
          onClick={handleTestAI}
          className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          🤖 Test AI Response
        </button>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Check console for AI output</p>
        </div>
      </div>
    </div>
  );
}