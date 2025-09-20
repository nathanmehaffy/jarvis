/* eslint-disable @typescript-eslint/no-explicit-any */
import { TaskParser } from './taskParser';
import { ToolExecutor } from './toolExecutor';

const taskParser = new TaskParser();
const toolExecutor = new ToolExecutor();

interface ActionRecord {
  actionId: string;
  tool: string;
  parameters: Record<string, any>;
  sourceText: string;
  timestamp: number;
}

interface ConversationState {
  transcriptHistory: string;
  actionHistory: ActionRecord[];
  uiContext: any;
}

const state: ConversationState = {
  transcriptHistory: '',
  actionHistory: [],
  uiContext: {}
};

function updateTranscriptHistory(newTranscript: string) {
  const combined = newTranscript || '';
  state.transcriptHistory = combined.length > 2000 ? combined.slice(-2000) : combined;
}

function appendActionRecord(record: ActionRecord) {
  state.actionHistory.push(record);
  if (state.actionHistory.length > 10) {
    state.actionHistory = state.actionHistory.slice(-10);
  }
}

// Startup diagnostics
try {
  const isWorkerScope = typeof self !== 'undefined' && (self as unknown as { importScripts?: unknown }).importScripts !== undefined;
  // location is undefined in dedicated workers in some environments; guard accesses
  const href = (typeof location !== 'undefined' && location?.href) ? location.href : 'n/a';
  const origin = (typeof location !== 'undefined' && (location as any)?.origin) ? (location as any).origin : 'n/a';
  console.log('[AI Worker] Startup', { isWorkerScope, href, origin });
} catch {
  // ignore
}

self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SET_UI_CONTEXT':
      try { state.uiContext = data || {}; } catch {}
      break;
    case 'PROCESS_AI_REQUEST':
      processAIRequest(data);
      break;
    
    case 'PROCESS_TEXT_COMMAND':
      processTextCommand(data);
      break;
    
    case 'GENERATE_RESPONSE':
      generateResponse(data);
      break;
    
    case 'ANALYZE_DATA':
      analyzeData(data);
      break;
    
    default:
      console.warn(`Unknown AI worker message type: ${type}`);
  }
});

async function processTextCommand(data: any) {
  try {
    // New payload accepts { transcript, uiContext? } or string
    const transcript = (typeof data?.transcript === 'string') ? data.transcript : (typeof data === 'string' ? data : '');
    if (!transcript) {
      throw new Error('No transcript provided');
    }
    if (data && typeof data === 'object' && data.uiContext) {
      state.uiContext = data.uiContext;
    }

    updateTranscriptHistory(transcript);

    console.log('[AI Worker] Processing transcript', {
      uiContextSummary: {
        windowsCount: Array.isArray(state.uiContext?.windows) ? state.uiContext.windows.length : 0
      }
    });

    // Ask parser for new tool calls based on ConversationState
    const parseResult: any = await taskParser.parseTextToTasks({
      transcript: state.transcriptHistory,
      actionHistory: state.actionHistory,
      uiContext: state.uiContext
    } as any);

    const newCalls: Array<{ tool: string; parameters: any; sourceText: string }> = Array.isArray(parseResult?.new_tool_calls) ? parseResult.new_tool_calls : [];

    const executionResults: any[] = [];
    for (const call of newCalls) {
      const record: ActionRecord = {
        actionId: generateId(),
        tool: call.tool,
        parameters: call.parameters,
        sourceText: call.sourceText,
        timestamp: Date.now()
      };
      try {
        const res = await toolExecutor.executeTasks([
          { id: record.actionId, tool: record.tool, parameters: record.parameters, description: record.tool }
        ], state.uiContext);
        executionResults.push(...res);
      } finally {
        appendActionRecord(record);
      }
    }

    self.postMessage({
      type: 'TEXT_COMMAND_PROCESSED',
      data: {
        id: generateId(),
        success: true,
        originalText: transcript,
        tasks: newCalls,
        executionResults,
        processingTime: 0,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('[AI Worker] Error processing text command:', error);
    
    self.postMessage({
      type: 'AI_ERROR',
      data: { 
        error: error instanceof Error ? error.message : String(error), 
        textInput: (typeof data?.transcript === 'string') ? data.transcript : undefined,
        type: 'text_command_error'
      }
    });
  }
}

async function processAIRequest(request: any) {
  try {
    // If pre-parsed tasks are provided, execute them directly
    if (Array.isArray(request?.tasks)) {
      const executionResults = await toolExecutor.executeTasks(request.tasks);
      self.postMessage({
        type: 'AI_TASKS_EXECUTED',
        data: {
          id: request.id || generateId(),
          success: true,
          tasks: request.tasks,
          executionResults,
          timestamp: Date.now()
        }
      });
      return;
    }

    // Legacy support for existing AI request format
    // Try to extract text from various possible fields
    const text = request.text || request.command || request.input || request.prompt?.text;
    
    if (text) {
      // Delegate to the new text command processor
      await processTextCommand(text);
      return;
    }
    
    // Fallback to old behavior for non-text requests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = {
      id: request.id || generateId(),
      processed: true,
      timestamp: Date.now(),
      request
    };
    
    self.postMessage({
      type: 'AI_REQUEST_PROCESSED',
      data: response
    });
  } catch (error) {
    self.postMessage({
      type: 'AI_ERROR',
      data: { error: error instanceof Error ? error.message : String(error), request }
    });
  }
}

async function generateResponse(prompt: any) {
  try {
    // Check if this is a text command that should be processed differently
    const text = prompt.text || prompt.command || prompt.prompt;
    
    if (text && (typeof text === 'string')) {
      // Delegate to text command processor
      await processTextCommand(text);
      return;
    }
    
    // Fallback to simple response generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const response = {
      id: generateId(),
      response: `AI response to: ${JSON.stringify(prompt)}`,
      timestamp: Date.now(),
      prompt
    };
    
    self.postMessage({
      type: 'AI_RESPONSE_GENERATED',
      data: response
    });
  } catch (error) {
    self.postMessage({
      type: 'AI_ERROR',
      data: { error: error instanceof Error ? error.message : String(error), prompt }
    });
  }
}

async function analyzeData(data: any) {
  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const analysis = {
      id: generateId(),
      analysis: `Analysis of data: ${JSON.stringify(data)}`,
      confidence: Math.random(),
      timestamp: Date.now(),
      data
    };
    
    self.postMessage({
      type: 'AI_ANALYSIS_COMPLETE',
      data: analysis
    });
  } catch (error) {
    self.postMessage({
      type: 'AI_ERROR',
      data: { error: error instanceof Error ? error.message : String(error), data }
    });
  }
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export {};