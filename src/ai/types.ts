type JSONSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  enum?: Array<string | number | boolean>;
  required?: string[];
};

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema & { type: 'object'; properties: Record<string, JSONSchema>; required: string[] };
}

export interface CerebrasTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema & { type: 'object'; properties: Record<string, JSONSchema>; required: string[] };
  };
}

export interface Task {
  id: string;
  tool: string;
  parameters: Record<string, unknown>;
  description: string;
}

export interface WindowContext {
  title?: string;
  content?: string;
  type?: 'notification' | 'dialog' | 'settings' | 'sticky-note' | 'general' | 'lesson' | 'quiz' | 'hint' | 'explainer';
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  metadata?: Record<string, unknown>;
}

export interface OpenWindowParams {
  windowType: string;
  context: WindowContext;
}

export interface CloseWindowParams {
  windowId?: string; // direct id when known
  selector?: 'newest' | 'latest' | 'oldest' | 'active' | 'all'; // semantic selector
}

export interface EditWindowParams {
  /** Identify window either by id or by title (case-insensitive) */
  windowId?: string;
  titleMatch?: string;
  /** New title to set; omit to leave unchanged */
  newTitle?: string;
  /** New content to set; omit to leave unchanged */
  newContent?: string;
}

export interface CerebrasRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  tools?: CerebrasTool[];
  tool_choice?: string;
  response_format?: { type: 'text' | 'json_object' | 'json_schema'; json_schema?: unknown };
}

export interface CerebrasResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProcessingResult {
  success: boolean;
  tasks: Task[];
  rawResponse?: CerebrasResponse;
  error?: string;
  timestamp: number;
}

export interface WebSearchParams {
  query: string;
  resultCount?: number;
  displayMode?: 'auto' | 'full' | 'summary' | 'links';
}

export interface CreateGroupParams {
  name: string;
  color?: string;
}

export interface AssignGroupParams {
  groupName: string;
  windowId?: string;
  selector?: 'newest' | 'latest' | 'active' | 'all';
}

export interface CollapseGroupParams {
  groupName: string;
}

export interface ExpandGroupParams {
  groupName: string;
}

export interface SummarizeArticleParams {
  url: string;
  maxBullets?: number;
}

export interface AnalyzeImageParams {
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
}

export interface AnalyzePdfParams {
  pdfBase64?: string;
  pdfUrl?: string;
  prompt?: string;
}

export interface CreateTaskParams {
  title: string;
  due?: string;
  notes?: string;
}

export interface ViewTasksParams {
  filter?: 'all' | 'open' | 'done';
}

export interface SetReminderParams {
  message: string;
  time: string; // natural language or absolute time
}

export interface WeatherParams { location: string; }
export interface NewsParams { query: string; pageSize?: number; }
export interface StocksParams { symbol: string; }
