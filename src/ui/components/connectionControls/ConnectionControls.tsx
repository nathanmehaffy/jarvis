'use client';

import { useState } from 'react';

interface ConnectionControlsProps {
  showConnections: boolean;
  similarityThreshold: number;
  onToggleConnections: () => void;
  onThresholdChange: (threshold: number) => void;
}

export function ConnectionControls({
  showConnections,
  similarityThreshold,
  onToggleConnections,
  onThresholdChange
}: ConnectionControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 px-4 py-2 w-full text-left hover:bg-gray-50 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">Connections</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Expanded Controls */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {/* Show/Hide Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Show Connections
              </label>
              <button
                onClick={onToggleConnections}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showConnections ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showConnections ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Similarity Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Similarity Threshold
                </label>
                <span className="text-sm text-gray-500">
                  {Math.round(similarityThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={similarityThreshold}
                onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    (similarityThreshold - 0.1) / 0.8 * 100
                  }%, #e5e7eb ${(similarityThreshold - 0.1) / 0.8 * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Connection System</div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-1 bg-blue-500 rounded" style={{height: '4px'}}></div>
                  <span className="text-xs text-gray-600">Thick = Strong</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-1 bg-blue-500 rounded" style={{height: '1px'}}></div>
                  <span className="text-xs text-gray-600">Thin = Weak</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-xs text-gray-600">Groups by color</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}