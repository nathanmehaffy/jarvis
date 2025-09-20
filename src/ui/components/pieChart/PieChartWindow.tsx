'use client';

import { useState } from 'react';
import { PieChart } from './PieChart';
import { DataPoint } from './pieChart.types';

export function PieChartWindow() {
  const [data] = useState<DataPoint[]>([
    { label: 'Development', x: 0, y: 40 },
    { label: 'Design', x: 1, y: 25 },
    { label: 'Testing', x: 2, y: 20 },
    { label: 'Documentation', x: 3, y: 10 },
    { label: 'Deployment', x: 4, y: 5 }
  ]);

  const [title] = useState('Project Time Distribution');

  return (
    <div className="h-full w-full p-6">
      <PieChart
        data={data}
        title={title}
        width={600}
        height={450}
        showLabels={true}
        showPercentages={true}
        showLegend={true}
      />
    </div>
  );
}