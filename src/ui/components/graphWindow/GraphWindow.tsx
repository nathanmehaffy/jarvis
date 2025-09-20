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
    <div className="h-full w-full p-6">
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
  );
}