/* eslint-disable @typescript-eslint/no-explicit-any */
import { TaskParser } from './taskParser';
import { ToolExecutor } from './toolExecutor';

const taskParser = new TaskParser();
const toolExecutor = new ToolExecutor();

self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
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

async function processTextCommand(textInput: any) {
  try {
    const text = typeof textInput === 'string' ? textInput : textInput.text || textInput.command || '';
    
    if (!text) {
      throw new Error('No text input provided');
    }
    
    console.log(`[AI Worker] Processing text command: "${text}"`);
    
    // Parse text to tasks using Cerebras
    const parseResult = await taskParser.parseTextToTasks(text);
    
    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Failed to parse text to tasks');
    }
    
    console.log(`[AI Worker] Parsed ${parseResult.tasks.length} tasks:`, parseResult.tasks);
    
    // Execute the tasks
    const executionResults = await toolExecutor.executeTasks(parseResult.tasks);
    
    const response = {
      id: generateId(),
      success: true,
      originalText: text,
      tasks: parseResult.tasks,
      executionResults: executionResults,
      processingTime: parseResult.timestamp,
      timestamp: Date.now()
    };
    
    self.postMessage({
      type: 'TEXT_COMMAND_PROCESSED',
      data: response
    });
    
  } catch (error) {
    console.error('[AI Worker] Error processing text command:', error);
    
    self.postMessage({
      type: 'AI_ERROR',
      data: { 
        error: error instanceof Error ? error.message : String(error), 
        textInput,
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