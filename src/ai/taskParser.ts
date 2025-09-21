/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasClient } from './cerebrasClient';
import { AVAILABLE_TOOLS } from './tools';
import { Task } from './types';

export class TaskParser {
  private cerebrasClient: CerebrasClient;

  constructor(apiKey?: string) {
    this.cerebrasClient = new CerebrasClient(apiKey);
  }

  async parseTextToTasks(input: { transcript: string; actionHistory: Array<{ tool: string; parameters: any; sourceText: string }>; uiContext: any }): Promise<{ new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }> }> {
    const fullTranscript = (input?.transcript || '').toString();
    const uiContext = input?.uiContext || {};
    const actionHistory = Array.isArray(input?.actionHistory) ? input.actionHistory : [];

    console.log('🔍 [TaskParser] parseTextToTasks STARTED', {
      fullTranscript: fullTranscript,
      transcriptLength: fullTranscript.length,
      transcriptPreview: fullTranscript.slice(-120),
      uiWindows: Array.isArray(uiContext?.windows) ? uiContext.windows.length : 0,
      actionCount: actionHistory.length,
      actionHistory: actionHistory,
      timestamp: new Date().toISOString()
    });

    const systemPrompt = [
      'You are Jarvis, an AI assistant. Your primary function is to analyze an ongoing speech transcript and identify any NEW user commands that have not yet been executed.',
      '',
      'You will receive a JSON input with the user\'s full transcript, your recent action history, and the current UI state.',
      '',
      'Your task is to:',
      '1. Carefully read the entire `fullTranscript`.',
      '2. Compare the user\'s commands in the transcript against the `actionHistory`.',
      '3. Identify any explicit commands in the transcript that do NOT have a corresponding entry in the `actionHistory`.',
      '4. If you find new, complete commands, respond with a JSON object containing a `new_tool_calls` array.',
      '5. Each tool call in the array MUST include a `sourceText` property, containing the exact phrase from the transcript that justifies the action.',
      '6. If there are no new commands, or if a command is incomplete (e.g., "open a graph showing..."), respond with an empty `new_tool_calls` array.',
      '7. DO NOT re-issue tool calls for commands that are already present in the `actionHistory`.'
    ].join('\n');

    const jsonPayload = {
      fullTranscript: fullTranscript,
      actionHistory: actionHistory,
      uiContext: uiContext,
      availableTools: AVAILABLE_TOOLS
    } as any;

    console.log('🤖 [TaskParser] Calling Cerebras LLM', {
      model: 'qwen-3-235b-a22b-instruct-2507',
      systemPrompt: systemPrompt,
      userPayload: jsonPayload,
      payloadSize: JSON.stringify(jsonPayload).length,
      timestamp: new Date().toISOString()
    });

    const llmCallStart = Date.now();
    const response = await this.cerebrasClient.createChatCompletion({
      model: 'qwen-3-235b-a22b-instruct-2507',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(jsonPayload) }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.1
    });

    const llmCallEnd = Date.now();
    console.log('📝 [TaskParser] Cerebras LLM Response received', {
      responseTime: `${llmCallEnd - llmCallStart}ms`,
      response: response,
      content: response?.choices?.[0]?.message?.content,
      timestamp: new Date().toISOString()
    });

    const content: unknown = response?.choices?.[0]?.message?.content;

    const coerce = (input: unknown): { new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }> } => {
      const empty = { new_tool_calls: [] as Array<{ tool: string; parameters: any; sourceText: string }> };
      try {
        const obj = typeof input === 'string' ? JSON.parse(input) : input;
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return empty;
        const calls = Array.isArray((obj as any).new_tool_calls) ? (obj as any).new_tool_calls : [];
        const cleaned = calls.map((c: any) => ({
          tool: String(c?.tool || c?.name || ''),
          parameters: (typeof c?.parameters === 'object' && c?.parameters) ? c.parameters : (typeof c?.args === 'object' ? c.args : {}),
          sourceText: String(c?.sourceText || c?.source_text || '')
        })).filter((c: any) => c.tool && typeof c.parameters === 'object');
        return { new_tool_calls: cleaned };
      } catch {
        return empty;
      }
    };

    let result = coerce(content);

    console.log('🔧 [TaskParser] LLM Response coerced to result', {
      rawContent: content,
      parsedResult: result,
      toolCallsFound: result.new_tool_calls.length,
      timestamp: new Date().toISOString()
    });

    // Fallback parsing for search commands if Cerebras didn't find any
    if (result.new_tool_calls.length === 0) {
      console.log('🔍 [TaskParser] No tool calls from LLM, trying fallback search parsing');
      const searchPatterns = [
        /search\s+(?:for\s+)?(.+)/i,
        /find\s+(?:information\s+)?(?:about\s+)?(.+)/i,
        /look\s+up\s+(.+)/i,
        /research\s+(.+)/i
      ];

      for (const pattern of searchPatterns) {
        const match = fullTranscript.match(pattern);
        if (match && match[1]) {
          const query = match[1].trim();
          result = {
            new_tool_calls: [{
              tool: 'search',
              parameters: { query },
              sourceText: match[0]
            }]
          };
          console.log('✅ [TaskParser] Found search command via fallback parsing:', {
            query: query,
            matchedPattern: pattern.toString(),
            fullMatch: match[0],
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    console.log('✅ [TaskParser] parseTextToTasks COMPLETED', {
      finalResult: result,
      toolCallsToExecute: result.new_tool_calls.length,
      timestamp: new Date().toISOString()
    });

    return result;
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
