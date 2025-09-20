'use client';

import { useState } from 'react';
import { BarGraph, DataPoint } from '../barGraph';

export function BarGraphWindow() {
  const [data] = useState<DataPoint[]>([
    { label: 'Jan', x: 0, y: 45 },
    { label: 'Feb', x: 1, y: 52 },
    { label: 'Mar', x: 2, y: 38 },
    { label: 'Apr', x: 3, y: 61 },
    { label: 'May', x: 4, y: 55 },
    { label: 'Jun', x: 5, y: 67 },
    { label: 'Jul', x: 6, y: 43 },
    { label: 'Aug', x: 7, y: 58 },
    { label: 'Sep', x: 8, y: 72 },
    { label: 'Oct', x: 9, y: 65 },
    { label: 'Nov', x: 10, y: 78 },
    { label: 'Dec', x: 11, y: 85 }
  ]);

  const [title] = useState('Monthly Sales Data');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-600/30 bg-gray-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📊</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Bar Graph</h3>
            <p className="text-xs text-gray-300">
              Monthly sales data visualization
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6">
        <BarGraph
          data={data}
          title={title}
          xAxisLabel="Month"
          yAxisLabel="Sales ($K)"
          width={600}
          height={450}
          barColor="#3b82f6"
          barHoverColor="#1d4ed8"
          showGrid={true}
          showValues={true}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-600/30 bg-gray-800/30 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>Months: {data.length}</span>
        <span>Total: ${data.reduce((sum, item) => sum + item.y, 0)}K</span>
      </div>
    </div>
  );
}