'use client';

import { useMemo, useState } from 'react';
import { DataPoint, BarGraphProps, GraphBounds } from './barGraph.types';

export function BarGraph({
  data,
  width = 600,
  height = 400,
  title = 'Bar Graph',
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  barColor = '#3b82f6',
  barHoverColor = '#1d4ed8',
  gridColor = '#374151',
  backgroundColor = 'transparent',
  showGrid = true,
  showValues = true,
  barSpacing = 0.2,
  barBorderRadius = 4
}: BarGraphProps) {
  const [hoveredBar, setHoveredBar] = useState<DataPoint | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const margin = { top: 60, right: 40, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const bounds = useMemo((): GraphBounds => {
    if (data.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };

    const yValues = data.map(d => d.y);
    const minY = Math.min(0, Math.min(...yValues)); // Include 0 for bars
    const maxY = Math.max(...yValues);

    return {
      minX: 0,
      maxX: data.length - 1,
      minY,
      maxY: maxY + (maxY - minY) * 0.1 // Add 10% padding at top
    };
  }, [data]);

  const barWidth = useMemo(() => {
    if (data.length === 0) return 0;
    const availableWidth = chartWidth * (1 - barSpacing);
    return availableWidth / data.length;
  }, [data.length, chartWidth, barSpacing]);

  const scaleX = (index: number) => {
    const spacing = chartWidth * barSpacing / (data.length + 1);
    return spacing + (index * (barWidth + spacing));
  };

  const scaleY = (y: number) => {
    const range = bounds.maxY - bounds.minY;
    if (range === 0) return chartHeight / 2;
    return chartHeight - ((y - bounds.minY) / range) * chartHeight;
  };

  const getBarHeight = (y: number) => {
    const baseY = scaleY(Math.max(0, bounds.minY));
    const topY = scaleY(y);
    return Math.abs(baseY - topY);
  };

  const getBarY = (y: number) => {
    if (y >= 0) return scaleY(y);
    return scaleY(0);
  };

  const gridLines = useMemo(() => {
    const lines = [];
    const numGridLines = 5;

    if (showGrid) {
      // Horizontal grid lines
      for (let i = 0; i <= numGridLines; i++) {
        const value = bounds.minY + ((bounds.maxY - bounds.minY) / numGridLines) * i;
        const y = scaleY(value);
        lines.push(
          <line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={chartWidth}
            y2={y}
            stroke={gridColor}
            strokeWidth={1}
            opacity={0.5}
          />
        );
      }
    }

    return lines;
  }, [showGrid, chartWidth, chartHeight, gridColor, bounds]);

  const xAxisLabels = useMemo(() => {
    return data.map((point, index) => (
      <text
        key={`x-label-${index}`}
        x={scaleX(index) + barWidth / 2}
        y={chartHeight + 20}
        textAnchor="middle"
        className="text-xs fill-gray-300"
      >
        {point.label}
      </text>
    ));
  }, [data, barWidth, chartHeight]);

  const yAxisLabels = useMemo(() => {
    const labels = [];
    const numLabels = 5;

    for (let i = 0; i <= numLabels; i++) {
      const value = bounds.minY + ((bounds.maxY - bounds.minY) / numLabels) * i;
      const y = scaleY(value);

      labels.push(
        <text
          key={`y-label-${i}`}
          x={-10}
          y={y + 4}
          textAnchor="end"
          className="text-xs fill-gray-300"
        >
          {value.toFixed(1)}
        </text>
      );
    }

    return labels;
  }, [bounds, chartHeight]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="relative">
        <svg
          width={width}
          height={height}
          className="border border-gray-600/30 rounded-lg"
          style={{ backgroundColor }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredBar(null)}
        >
          {/* Chart area */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid lines */}
            {gridLines}

            {/* Bars */}
            {data.map((point, index) => {
              const x = scaleX(index);
              const y = getBarY(point.y);
              const barHeight = getBarHeight(point.y);
              const isHovered = hoveredBar === point;

              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={isHovered ? barHoverColor : barColor}
                    rx={barBorderRadius}
                    ry={barBorderRadius}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredBar(point)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />

                  {/* Value labels on bars */}
                  {showValues && (
                    <text
                      x={x + barWidth / 2}
                      y={point.y >= 0 ? y - 5 : y + barHeight + 15}
                      textAnchor="middle"
                      className="text-xs fill-gray-100 font-medium"
                    >
                      {point.y.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Axis labels */}
            {xAxisLabels}
            {yAxisLabels}
          </g>

          {/* Axis titles */}
          <text
            x={width / 2}
            y={height - 20}
            textAnchor="middle"
            className="text-sm font-medium fill-cyan-200"
          >
            {xAxisLabel}
          </text>

          <text
            x={20}
            y={height / 2}
            textAnchor="middle"
            transform={`rotate(-90, 20, ${height / 2})`}
            className="text-sm font-medium fill-cyan-200"
          >
            {yAxisLabel}
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredBar && (
          <div
            className="absolute bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-10"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 30,
              transform: mousePosition.x > width - 100 ? 'translateX(-100%)' : 'none'
            }}
          >
            <div className="font-semibold">{hoveredBar.label}</div>
            <div>Value: {hoveredBar.y.toFixed(2)}</div>
          </div>
        )}
      </div>
    </div>
  );
}