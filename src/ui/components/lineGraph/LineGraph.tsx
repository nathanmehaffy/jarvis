'use client';

import { useMemo, useState } from 'react';
import { DataPoint, LineGraphProps, GraphBounds } from './lineGraph.types';

export function LineGraph({
  data,
  width = 600,
  height = 400,
  title = 'Line Graph',
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  lineColor = '#8b5cf6',
  pointColor = '#7c3aed',
  gridColor = '#374151',
  backgroundColor = 'transparent',
  showGrid = true,
  showPoints = true,
  lineThickness = 2,
  pointRadius = 4,
  shadeFromY = undefined,
  shadeBetweenX = undefined,
  areaFill = 'rgba(139,92,246,0.18)',
  areaStroke = '#8b5cf6'
}: LineGraphProps) {
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const margin = { top: 60, right: 40, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const bounds = useMemo((): GraphBounds => {
    if (data.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };

    const xValues = data.map(d => d.x);
    const yValues = data.map(d => d.y);

    return {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues)
    };
  }, [data]);

  const scaleX = (x: number) => {
    const range = bounds.maxX - bounds.minX;
    if (range === 0) return chartWidth / 2;
    return ((x - bounds.minX) / range) * chartWidth;
  };

  const scaleY = (y: number) => {
    const range = bounds.maxY - bounds.minY;
    if (range === 0) return chartHeight / 2;
    return chartHeight - ((y - bounds.minY) / range) * chartHeight;
  };

  const pathData = useMemo(() => {
    if (data.length === 0) return '';

    const points = data.map(d => `${scaleX(d.x)},${scaleY(d.y)}`).join(' L ');
    return `M ${points}`;
  }, [data, bounds, chartWidth, chartHeight]);

  const shadedPolygon = useMemo(() => {
    if (!shadeBetweenX || shadeFromY === undefined || data.length === 0) return null;

    const xMin = Math.min(shadeBetweenX.from, shadeBetweenX.to);
    const xMax = Math.max(shadeBetweenX.from, shadeBetweenX.to);
    const within = data
      .filter(d => d.x >= xMin && d.x <= xMax)
      .sort((a,b) => a.x - b.x);

    if (within.length < 2) return null;

    const points = [
      `${scaleX(within[0].x)},${scaleY(shadeFromY)}`,
      ...within.map(d => `${scaleX(d.x)},${scaleY(d.y)}`),
      `${scaleX(within[within.length - 1].x)},${scaleY(shadeFromY)}`
    ].join(' ');

    return (
      <polygon
        points={points}
        fill={areaFill}
        stroke={areaStroke}
        strokeWidth={1}
        opacity={0.9}
      />
    );
  }, [data, shadeBetweenX, shadeFromY, areaFill, areaStroke, chartWidth, chartHeight, bounds]);

  const gridLines = useMemo(() => {
    const lines = [];
    const numGridLines = 5;

    if (showGrid) {
      // Vertical grid lines
      for (let i = 0; i <= numGridLines; i++) {
        const x = (chartWidth / numGridLines) * i;
        lines.push(
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={chartHeight}
            stroke={gridColor}
            strokeWidth={1}
            opacity={0.5}
          />
        );
      }

      // Horizontal grid lines
      for (let i = 0; i <= numGridLines; i++) {
        const y = (chartHeight / numGridLines) * i;
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
  }, [showGrid, chartWidth, chartHeight, gridColor]);

  const xAxisLabels = useMemo(() => {
    const labels = [];
    const numLabels = 5;

    for (let i = 0; i <= numLabels; i++) {
      const value = bounds.minX + ((bounds.maxX - bounds.minX) / numLabels) * i;
      const x = (chartWidth / numLabels) * i;

      labels.push(
        <text
          key={`x-label-${i}`}
          x={x}
          y={chartHeight + 20}
          textAnchor="middle"
          className="text-xs fill-gray-300"
        >
          {value.toFixed(1)}
        </text>
      );
    }

    return labels;
  }, [bounds, chartWidth, chartHeight]);

  const yAxisLabels = useMemo(() => {
    const labels = [];
    const numLabels = 5;

    for (let i = 0; i <= numLabels; i++) {
      const value = bounds.minY + ((bounds.maxY - bounds.minY) / numLabels) * i;
      const y = chartHeight - (chartHeight / numLabels) * i;

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
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Chart area */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid lines */}
            {gridLines}

          {/* Shaded area under curve */}
          {shadedPolygon}

            {/* Main line */}
            {data.length > 1 && (
              <path
                d={pathData}
                fill="none"
                stroke={lineColor}
                strokeWidth={lineThickness}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {showPoints && data.map((point, index) => (
              <circle
                key={index}
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                r={pointRadius}
                fill={pointColor}
                stroke="#1f2937"
                strokeWidth={2}
                className="cursor-pointer hover:r-6 transition-all"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}

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
        {hoveredPoint && (
          <div
            className="absolute bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-10"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 30,
              transform: mousePosition.x > width - 100 ? 'translateX(-100%)' : 'none'
            }}
          >
            <div className="font-semibold">{hoveredPoint.label}</div>
            <div>X: {hoveredPoint.x.toFixed(2)}</div>
            <div>Y: {hoveredPoint.y.toFixed(2)}</div>
          </div>
        )}
      </div>
    </div>
  );
}