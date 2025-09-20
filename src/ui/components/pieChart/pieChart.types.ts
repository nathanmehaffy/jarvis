export interface DataPoint {
  label: string;
  x: number; // Not used for pie charts but kept for consistency
  y: number; // This will be the value for the pie slice
}

export interface PieSlice {
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export interface PieChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  radius?: number;
  innerRadius?: number; // For donut charts
  colors?: string[];
  showLabels?: boolean;
  showPercentages?: boolean;
  showLegend?: boolean;
  animationDuration?: number;
}