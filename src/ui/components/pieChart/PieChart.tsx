'use client';

import { useMemo, useState } from 'react';
import { DataPoint, PieChartProps, PieSlice } from './pieChart.types';

export function PieChart({
  data,
  width = 500,
  height = 400,
  title = 'Pie Chart',
  radius = 120,
  innerRadius = 0,
  colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ],
  showLabels = true,
  showPercentages = true,
  showLegend = true,
  animationDuration = 300
}: PieChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<PieSlice | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const centerX = width / 2;
  const centerY = height / 2 - 10; // Slightly offset for title

  const pieSlices = useMemo((): PieSlice[] => {
    const total = data.reduce((sum, item) => sum + Math.abs(item.y), 0);
    if (total === 0) return [];

    let currentAngle = -Math.PI / 2; // Start at top

    return data.map((item, index) => {
      const value = Math.abs(item.y);
      const percentage = (value / total) * 100;
      const sliceAngle = (value / total) * 2 * Math.PI;

      const slice: PieSlice = {
        label: item.label,
        value,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
        color: colors[index % colors.length]
      };

      currentAngle += sliceAngle;
      return slice;
    });
  }, [data, colors]);

  const createArcPath = (slice: PieSlice, outerRadius: number, innerRadius: number = 0) => {
    const { startAngle, endAngle } = slice;

    const x1 = centerX + Math.cos(startAngle) * outerRadius;
    const y1 = centerY + Math.sin(startAngle) * outerRadius;
    const x2 = centerX + Math.cos(endAngle) * outerRadius;
    const y2 = centerY + Math.sin(endAngle) * outerRadius;

    const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

    if (innerRadius === 0) {
      // Regular pie slice
      return `M ${centerX},${centerY} L ${x1},${y1} A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${x2},${y2} Z`;
    } else {
      // Donut slice
      const x3 = centerX + Math.cos(startAngle) * innerRadius;
      const y3 = centerY + Math.sin(startAngle) * innerRadius;
      const x4 = centerX + Math.cos(endAngle) * innerRadius;
      const y4 = centerY + Math.sin(endAngle) * innerRadius;

      return `M ${x1},${y1} A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${x2},${y2} L ${x4},${y4} A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x3},${y3} Z`;
    }
  };

  const getLabelPosition = (slice: PieSlice) => {
    const midAngle = (slice.startAngle + slice.endAngle) / 2;
    const labelRadius = radius * 0.7;

    return {
      x: centerX + Math.cos(midAngle) * labelRadius,
      y: centerY + Math.sin(midAngle) * labelRadius
    };
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <h3 className="text-xl font-semibold text-cyan-200 mb-4">{title}</h3>

      <div className="flex items-start justify-center space-x-12">
        {/* Pie Chart */}
        <div className="relative flex-shrink-0">
          <svg
            width={width * 0.7}
            height={height}
            className="overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredSlice(null)}
          >
            {/* Pie slices */}
            {pieSlices.map((slice, index) => {
              const isHovered = hoveredSlice === slice;
              const sliceRadius = isHovered ? radius + 5 : radius;

              return (
                <g key={index}>
                  <path
                    d={createArcPath(slice, sliceRadius, innerRadius)}
                    fill={slice.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      filter: isHovered ? 'brightness(1.1)' : 'none'
                    }}
                    onMouseEnter={() => setHoveredSlice(slice)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />

                  {/* Labels */}
                  {showLabels && slice.percentage > 5 && (
                    <text
                      x={getLabelPosition(slice).x}
                      y={getLabelPosition(slice).y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-medium fill-white"
                      style={{ pointerEvents: 'none' }}
                    >
                      {showPercentages ? `${slice.percentage.toFixed(1)}%` : slice.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Center text for donut charts */}
            {innerRadius > 0 && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-lg font-semibold fill-cyan-200"
              >
                Total
              </text>
            )}
          </svg>

          {/* Tooltip */}
          {hoveredSlice && (
            <div
              className="absolute bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-10"
              style={{
                left: mousePosition.x + 10,
                top: mousePosition.y - 30,
                transform: mousePosition.x > width * 0.35 ? 'translateX(-100%)' : 'none'
              }}
            >
              <div className="font-semibold">{hoveredSlice.label}</div>
              <div>Value: {hoveredSlice.value.toFixed(2)}</div>
              <div>Percentage: {hoveredSlice.percentage.toFixed(1)}%</div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-col space-y-2">
            <h4 className="text-sm font-semibold text-cyan-200 mb-2">Legend</h4>
            {pieSlices.map((slice, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 rounded px-2 py-1 transition-colors"
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="text-sm">
                  <div className="font-medium text-gray-100">{slice.label}</div>
                  <div className="text-xs text-gray-300">
                    {slice.value.toFixed(1)} ({slice.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}