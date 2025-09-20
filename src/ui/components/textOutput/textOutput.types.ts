export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface TextOutputProps {
  maxEntries?: number;
  showTimestamp?: boolean;
  autoScroll?: boolean;
}