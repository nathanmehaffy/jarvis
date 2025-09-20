/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasClient } from './cerebrasClient';
import { AVAILABLE_TOOLS } from './tools';
import { Task, AIProcessingResult } from './types';

export class TaskParser {
  private cerebrasClient: CerebrasClient;

  constructor(apiKey?: string) {
    this.cerebrasClient = new CerebrasClient(apiKey);
  }

  async parseTextToTasks(text: string): Promise<AIProcessingResult> {
    try {
      const startTime = Date.now();
      
      // Use Cerebras to process the natural language input
      const response = await this.cerebrasClient.processTextToTasks(text, AVAILABLE_TOOLS);
      
      let tasks: Task[] = [];
      
      // Extract tool calls from the response
      if (response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        
        if (choice.message.tool_calls) {
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.type === 'function') {
              try {
                const parameters = JSON.parse(toolCall.function.arguments);
                
                let task: Task = {
                  id: this.generateTaskId(),
                  tool: toolCall.function.name,
                  parameters: parameters,
                  description: this.generateTaskDescription(toolCall.function.name, parameters)
                };
                // Normalize education intents for consistency (e.g., explain -> explainer)
                task = this.normalizeEducationIntent(text, task);
                tasks.push(task);
              } catch (parseError) {
                console.error('Failed to parse tool call arguments:', parseError);
              }
            }
          }
        }
      }
      // Final normalization pass
      tasks = tasks.map(t => this.normalizeEducationIntent(text, t));

      // If no tool calls were generated, try to handle simple cases with fallback parsing
      if (tasks.length === 0) {
        const fallbackTasks = this.fallbackParsing(text);
        tasks.push(...fallbackTasks);
      }
      
      return {
        success: true,
        tasks: tasks,
        rawResponse: response,
        timestamp: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Error parsing text to tasks:', error);
      
      // Fallback to simple parsing if Cerebras fails
      const fallbackTasks = this.fallbackParsing(text);
      
      return {
        success: fallbackTasks.length > 0,
        tasks: fallbackTasks,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private fallbackParsing(text: string): Task[] {
    const tasks: Task[] = [];
    const lowerText = text.toLowerCase();
    
    // Simple pattern matching for common commands
    if (lowerText.includes('open') || lowerText.includes('create') || lowerText.includes('show') || lowerText.includes('start')) {
      let windowType = 'general';
      let content = '';
      let metadata: Record<string, any> | undefined = undefined;
      
      if (lowerText.includes('sticky note') || lowerText.includes('note')) {
        windowType = 'sticky-note';
        // Extract content after "note" or similar keywords
        const noteMatch = text.match(/(?:sticky note|note|reminder)(?:\s+(?:saying|with|that says|about))?\s*["']?([^"']+)["']?/i);
        content = noteMatch ? noteMatch[1].trim() : 'New sticky note';
      } else if (lowerText.includes('lesson')) {
        windowType = 'lesson';
        const title = this.extractTitle(text) || 'New Lesson';
        const stepMatch = text.match(/step\s*(\d+)/i);
        const lessonIdMatch = text.match(/lesson\s*(id\s*)?(\w+)/i);
        metadata = {
          lessonId: lessonIdMatch ? lessonIdMatch[2] : undefined,
          step: stepMatch ? Number(stepMatch[1]) : undefined
        };
        content = content || 'Lesson content';
      } else if (lowerText.includes('quiz')) {
        windowType = 'quiz';
        const title = this.extractTitle(text) || 'Quiz';
        metadata = { title };
        content = content || 'Quiz content';
      } else if (lowerText.includes('hint')) {
        windowType = 'hint';
        const hintMatch = text.match(/hint(?:\s+(?:about|for))?\s*["']?([^"']+)["']?/i);
        content = hintMatch ? hintMatch[1].trim() : 'Hint';
      } else if (lowerText.includes('explain') || lowerText.includes('explainer')) {
        windowType = 'explainer';
        const topicMatch = text.match(/explain(?:\s+(?:about|the|how to))?\s*["']?([^"']+)["']?/i);
        content = topicMatch ? topicMatch[1].trim() : 'Explanation';
      } else if (lowerText.includes('notification')) {
        windowType = 'notification';
        content = 'Notification';
      } else if (lowerText.includes('dialog')) {
        windowType = 'dialog';
        content = 'Dialog window';
      } else if (lowerText.includes('settings')) {
        windowType = 'settings';
        content = 'Settings';
      }
      
      tasks.push({
        id: this.generateTaskId(),
        tool: 'open_window',
        parameters: {
          windowType: windowType,
          context: {
            title: this.extractTitle(text) || this.capitalizeFirst(windowType),
            content: content || 'Window content',
            type: windowType,
            metadata
          }
        },
        description: `Open ${windowType} window`
      });
    }
    
    if (lowerText.includes('close')) {
      // Look for window ID patterns
      const idMatch = text.match(/(?:window|id)\s+(\w+)/i);
      const windowId = idMatch ? idMatch[1] : 'unknown';
      
      tasks.push({
        id: this.generateTaskId(),
        tool: 'close_window',
        parameters: {
          windowId: windowId
        },
        description: `Close window ${windowId}`
      });
    }
    
    return tasks;
  }

  private extractTitle(text: string): string | null {
    // Extract title from patterns like 'open a "Title" window' or 'create window titled "Title"'
    const titlePatterns = [
      /"([^"]+)"/,
      /'([^']+)'/,
      /titled\s+(.+?)(?:\s+window|$)/i,
      /called\s+(.+?)(?:\s+window|$)/i,
      /named\s+(.+?)(?:\s+window|$)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private normalizeEducationIntent(text: string, task: Task): Task {
    try {
      const lowerText = text.toLowerCase();
      if (task.tool !== 'open_window') return task;
      const params = task.parameters as any;
      if (!params || !params.context) return task;
      const currentType = (params.windowType || params.context.type || '').toLowerCase();

      // Map explain intents to explainer type if model returned general
      if ((lowerText.includes('explain') || lowerText.includes('explainer') || lowerText.includes('step by step')) && (currentType === 'general' || currentType === '')) {
        params.windowType = 'explainer';
        params.context.type = 'explainer';
        if (!params.context.title) {
          const topicMatch = text.match(/explain(?:\s+(?:about|the|how to))?\s*["']?([^"']+)["']?/i);
          params.context.title = topicMatch ? this.capitalizeFirst(topicMatch[1].trim()) : 'Explainer';
        }
        if (!params.context.content) {
          params.context.content = 'Explanation';
        }
        task.description = this.generateTaskDescription('open_window', params);
      }

      // Map lesson intent
      if (lowerText.includes('lesson') && (currentType === 'general' || currentType === '')) {
        params.windowType = params.windowType || 'lesson';
        params.context.type = params.context.type || 'lesson';
      }

      // Map quiz intent
      if (lowerText.includes('quiz') && (currentType === 'general' || currentType === '')) {
        params.windowType = params.windowType || 'quiz';
        params.context.type = params.context.type || 'quiz';
      }

      // Map hint intent
      if (lowerText.includes('hint') && (currentType === 'general' || currentType === '')) {
        params.windowType = params.windowType || 'hint';
        params.context.type = params.context.type || 'hint';
      }

      return task;
    } catch {
      return task;
    }
  }

  private generateTaskDescription(toolName: string, parameters: any): string {
    switch (toolName) {
      case 'open_window':
        return `Open ${parameters.windowType || 'window'}: ${parameters.context?.title || 'Untitled'}`;
      case 'close_window':
        return `Close window: ${parameters.windowId}`;
      default:
        return `Execute ${toolName}`;
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
