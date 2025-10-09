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
  // Keep more context but still limit to prevent excessive token usage
  state.transcriptHistory = combined.length > 4000 ? combined.slice(-4000) : combined;
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
    case 'SET_BASE_ORIGIN':
      try {
        const origin = typeof data?.origin === 'string' ? data.origin : '';
        (self as any).__BASE_ORIGIN__ = origin;
        console.log('🌐 [AI Worker] Base origin set', { origin });
      } catch {}
      break;
    case 'SET_UI_CONTEXT':
      try { state.uiContext = data || {}; } catch {}
      break;
    
    case 'PROCESS_TEXT_COMMAND':
      processTextCommand(data);
      break;
    
    case 'GENERATE_RESPONSE':
      generateResponse(data);
      break;
    
    
    default:
      console.warn(`Unknown AI worker message type: ${type}`);
  }
});

async function processTextCommand(data: any) {
  try {
    console.log('🚀 [AI Worker] processTextCommand STARTED', {
      data: data,
      dataType: typeof data,
      timestamp: new Date().toISOString()
    });

    // New payload accepts { transcript, pastTranscript?, currentDirective?, uiContext? } or string
    const transcript = (typeof data?.transcript === 'string') ? data.transcript : (typeof data === 'string' ? data : '');
    if (!transcript) {
      const error = 'No transcript provided';
      console.error('❌ [AI Worker] Validation failed', { data, error, timestamp: new Date().toISOString() });
      throw new Error(error);
    }

    console.log('📝 [AI Worker] Transcript extracted', {
      transcript: transcript,
      transcriptLength: transcript.length,
      timestamp: new Date().toISOString()
    });

    if (data && typeof data === 'object' && data.uiContext) {
      console.log('🖥️ [AI Worker] UI Context received', {
        oldContext: state.uiContext,
        newContext: data.uiContext,
        timestamp: new Date().toISOString()
      });
      state.uiContext = data.uiContext;
    }

    // Maintain transcript history as the full text for context
    updateTranscriptHistory(transcript);

    console.log('📊 [AI Worker] State updated, processing transcript', {
      transcriptHistory: state.transcriptHistory,
      actionHistoryCount: state.actionHistory.length,
      uiContextSummary: {
        windowsCount: Array.isArray(state.uiContext?.windows) ? state.uiContext.windows.length : 0,
        context: state.uiContext
      },
      timestamp: new Date().toISOString()
    });

    // Ask parser for new tool calls based on split directive and past transcript
    console.log('🤖 [AI Worker] Calling taskParser.parseTextToTasks', {
      conversationState: {
        transcript: state.transcriptHistory,
        actionHistory: state.actionHistory,
        uiContext: state.uiContext
      },
      split: {
        pastTranscript: typeof data?.pastTranscript === 'string' ? data.pastTranscript : undefined,
        currentDirective: typeof data?.currentDirective === 'string' ? data.currentDirective : undefined
      },
      timestamp: new Date().toISOString()
    });

    const parseStart = Date.now();
    const parseResult: any = await taskParser.parseTextToTasks({
      transcript: state.transcriptHistory,
      actionHistory: state.actionHistory,
      uiContext: state.uiContext,
      pastTranscript: typeof data?.pastTranscript === 'string' ? data.pastTranscript : undefined,
      currentDirective: typeof data?.currentDirective === 'string' ? data.currentDirective : undefined
    } as any);
    const parseEnd = Date.now();

    console.log('📄 [AI Worker] taskParser response received', {
      parseTime: `${parseEnd - parseStart}ms`,
      parseResult: parseResult,
      timestamp: new Date().toISOString()
    });

    const newCalls: Array<{ tool: string; parameters: any; sourceText: string }> = Array.isArray(parseResult?.new_tool_calls) ? parseResult.new_tool_calls : [];
    const conversationalResponse: string | undefined = parseResult?.conversational_response;

    console.log('🔧 [AI Worker] Tool calls and responses extracted from parse result', {
      newCallsCount: newCalls.length,
      newCalls: newCalls,
      hasConversationalResponse: !!conversationalResponse,
      conversationalResponse: conversationalResponse,
      timestamp: new Date().toISOString()
    });

    const executionResults: any[] = [];
    for (const call of newCalls) {
      const record: ActionRecord = {
        actionId: generateId(),
        tool: call.tool,
        parameters: call.parameters,
        sourceText: call.sourceText,
        timestamp: Date.now()
      };

      console.log('🔨 [AI Worker] Executing tool call', {
        record: record,
        uiContext: state.uiContext,
        timestamp: new Date().toISOString()
      });

      try {
        const executionStart = Date.now();
        const res = await toolExecutor.executeTasks([
          { id: record.actionId, tool: record.tool, parameters: record.parameters, description: record.tool }
        ], state.uiContext);
        const executionEnd = Date.now();

        console.log('✅ [AI Worker] Tool execution completed', {
          actionId: record.actionId,
          tool: record.tool,
          executionTime: `${executionEnd - executionStart}ms`,
          results: res,
          timestamp: new Date().toISOString()
        });

        executionResults.push(...res);
      } catch (error) {
        console.error('❌ [AI Worker] Tool execution failed', {
          actionId: record.actionId,
          tool: record.tool,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      } finally {
        appendActionRecord(record);
        console.log('📝 [AI Worker] Action record appended to history', {
          record: record,
          totalHistoryLength: state.actionHistory.length,
          timestamp: new Date().toISOString()
        });
      }
    }

    const responseData = {
      id: generateId(),
      success: true,
      originalText: transcript,
      tasks: newCalls,
      executionResults,
      processingTime: 0,
      timestamp: Date.now(),
      conversationalResponse: conversationalResponse
    };

    console.log('🏁 [AI Worker] processTextCommand COMPLETED successfully', {
      responseData: responseData,
      timestamp: new Date().toISOString()
    });

    self.postMessage({
      type: 'TEXT_COMMAND_PROCESSED',
      data: responseData
    });

    // If there are NO tool calls and there's a conversational response, emit it
    if ((newCalls.length === 0) && conversationalResponse && conversationalResponse.trim()) {
      console.log('💬 [AI Worker] Sending conversational response', {
        response: conversationalResponse,
        timestamp: new Date().toISOString()
      });

      self.postMessage({
        type: 'AI_CONVERSATIONAL_RESPONSE',
        data: {
          id: generateId(),
          response: conversationalResponse,
          originalText: transcript,
          timestamp: Date.now()
        }
      });
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ [AI Worker] processTextCommand FAILED', error);
    console.error('❌ [AI Worker] Error details:', {
      message: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      data: data,
      timestamp: new Date().toISOString()
    });

    const errorData = {
      error: errorMsg,
      textInput: (typeof data?.transcript === 'string') ? data.transcript : undefined,
      type: 'text_command_error'
    };

    console.log('📢 [AI Worker] Posting error message to main thread', {
      errorData: errorData,
      timestamp: new Date().toISOString()
    });

    self.postMessage({
      type: 'AI_ERROR',
      data: errorData
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


function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export {};