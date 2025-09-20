/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasRequest, CerebrasResponse, Tool, CerebrasTool } from './types';

export class CerebrasClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    // In browser environment, we need to get the API key differently
    this.apiKey = apiKey || this.getApiKey();
    this.baseUrl = 'https://api.cerebras.ai/v1';
    
    if (!this.apiKey) {
      console.warn('Cerebras API key not found. Set CEREBRAS_API_KEY environment variable.');
    }
  }

  private getApiKey(): string {
    // Check multiple sources for the API key
    if (typeof process !== 'undefined' && process.env && process.env.CEREBRAS_API_KEY) {
      return process.env.CEREBRAS_API_KEY;
    }
    
    // For client-side, we'll need to get it from a different source
    // In Next.js, client-side env vars need to be prefixed with NEXT_PUBLIC_
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_CEREBRAS_API_KEY) {
      return process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;
    }
    
    return '';
  }

  async createChatCompletion(request: CerebrasRequest): Promise<CerebrasResponse> {
    if (!this.apiKey) {
      throw new Error('Cerebras API key is required. Please set CEREBRAS_API_KEY environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cerebras API error (${response.status}): ${errorText}`);
    }

    return await response.json() as CerebrasResponse;
  }

  async processTextToTasks(text: string, tools: Tool[]): Promise<CerebrasResponse> {
    const systemPrompt = `You are Jarvis, an AI assistant that converts natural language commands into structured tool calls.

Available tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Your job is to:
1. Analyze the user's text input
2. Identify what actions they want to perform
3. Convert those actions into appropriate tool calls
4. Handle complex multi-command requests by breaking them into multiple tool calls

For window operations:
- When opening windows, infer appropriate window types (sticky-note, notification, dialog, settings, general)
- Extract relevant context like titles, content, and any positioning hints
- For sticky notes specifically, use windowType "sticky-note" and include the note content in context.content

Always respond using the available tools. If the request is unclear, make reasonable assumptions.`;

    // Convert our tool format to Cerebras expected format
    const cerebrasTools: CerebrasTool[] = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    const request: CerebrasRequest = {
      model: 'llama3.1-8b',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      tools: cerebrasTools,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 1000
    };

    return await this.createChatCompletion(request);
  }
}
