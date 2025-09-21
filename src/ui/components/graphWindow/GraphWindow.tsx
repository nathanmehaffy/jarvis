'use client';

import { useState } from 'react';
import { LineGraph, DataPoint } from '../lineGraph';

export function GraphWindow() {
  const [data] = useState<DataPoint[]>([
    { label: 'Start', x: 0, y: 10 },
    { label: 'Peak', x: 1, y: 25 },
    { label: 'Dip', x: 2, y: 15 },
    { label: 'Rise', x: 3, y: 30 },
    { label: 'Valley', x: 4, y: 8 },
    { label: 'High', x: 5, y: 35 },
    { label: 'End', x: 6, y: 20 }
  ]);

  const [title] = useState('Sample Data Points');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-600/30 bg-gray-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-violet-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📈</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Line Graph</h3>
            <p className="text-xs text-gray-300">
              Interactive data visualization
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6">
        <LineGraph
          data={data}
          title={title}
          xAxisLabel="Time"
          yAxisLabel="Value"
          width={600}
          height={450}
          lineColor="#8b5cf6"
          pointColor="#7c3aed"
          showGrid={true}
          showPoints={true}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-600/30 bg-gray-800/30 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>Data Points: {data.length}</span>
        <span>Interactive</span>
      </div>
    </div>
  );
}