export interface DataPoint {
  label: string;
  x: number;
  y: number;
}

export interface BarGraphProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  barColor?: string;
  barHoverColor?: string;
  gridColor?: string;
  backgroundColor?: string;
  showGrid?: boolean;
  showValues?: boolean;
  barSpacing?: number;
  barBorderRadius?: number;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}