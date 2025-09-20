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
    <div className="h-full w-full p-6">
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
  );
}