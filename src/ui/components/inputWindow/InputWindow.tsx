'use client';

import { inputManager } from '@/input';

export function InputWindow() {
  const handleTestInput = () => {
    inputManager.processInput({ test: 'Hello from Input Window!' });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <div className="w-8 h-8 bg-white rounded-lg opacity-90"></div>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Input Manager</h3>
        <p className="text-gray-600 leading-relaxed">Process and handle input data through the event bus system</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 border border-blue-200/50">
        <button
          onClick={handleTestInput}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          🚀 Test Input Processing
        </button>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Check console for event output</p>
        </div>
      </div>
    </div>
  );
}