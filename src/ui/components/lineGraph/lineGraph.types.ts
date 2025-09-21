export interface DataPoint {
  label: string;
  x: number;
  y: number;
}

export interface LineGraphProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  lineColor?: string;
  pointColor?: string;
  gridColor?: string;
  backgroundColor?: string;
  showGrid?: boolean;
  showPoints?: boolean;
  lineThickness?: number;
  pointRadius?: number;
  shadeFromY?: number;
  shadeBetweenX?: { from: number; to: number };
  areaFill?: string;
  areaStroke?: string;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}