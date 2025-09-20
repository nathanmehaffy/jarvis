/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasRequest, CerebrasResponse, Tool, CerebrasTool } from './types';

export class CerebrasClient {
  // Client no longer holds API key; all calls go through server route
  constructor(_apiKey?: string) {}

  async createChatCompletion(request: CerebrasRequest): Promise<CerebrasResponse> {
    // Always call our internal API route which adds auth server-side
    let targetUrl = '/api/cerebras-tasks';

    try {
      // Debug: log environment context from worker/main thread
      const isWorkerScope = typeof self !== 'undefined' && (self as unknown as { importScripts?: unknown }).importScripts !== undefined;

      // In worker context, construct absolute URL using worker's location
      if (isWorkerScope) {
        let workerOrigin = 'http://localhost:3000'; // fallback

        try {
          // Try to get the actual origin from the worker's location
          if (typeof location !== 'undefined' && (location as any)?.origin) {
            workerOrigin = (location as any).origin;
          } else if (typeof location !== 'undefined' && location?.href) {
            // Fallback: extract origin from href
            const url = new URL(location.href);
            workerOrigin = url.origin;
          }
        } catch (error) {
          console.warn('[CerebrasClient] Failed to determine worker origin:', error);
        }

        targetUrl = `${workerOrigin}/api/cerebras-tasks`;
      }

      // Avoid leaking secrets; only log safe runtime details
      console.log('[CerebrasClient] createChatCompletion', {
        targetUrl,
        isWorkerScope,
        locationHref: (typeof location !== 'undefined' && location?.href) ? location.href : 'n/a',
        baseHref: (typeof document !== 'undefined' && (document as any)?.baseURI) ? (document as any).baseURI : 'n/a'
      });
    } catch {
      // ignore logging errors
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cerebrasRequest: request })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Internal API error (${response.status}): ${errorText}`);
    }

    return await response.json() as CerebrasResponse;
  }

  async processTextToTasks(text: string, tools: Tool[], uiContext: any = {}): Promise<CerebrasResponse> {
    const uiState = uiContext.windows && uiContext.windows.length > 0
      ? `Current open windows:\n${uiContext.windows.map((w: any) => `- id: ${w.id}, title: ${w.title}, content: ${w.content ? `"${w.content.substring(0,100).replace(/\n/g, ' ').replace(/"/g, '\\"')}"${w.content.length > 100 ? '...' : ''}` : 'none'}`).join('\n')}`
      : 'No windows are currently open.';

    const systemPrompt = `You are Jarvis, an AI assistant that converts natural language commands into structured tool calls.

${uiState}

Available tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Your job is to:
1. Analyze the user's text input and the current UI state.
2. Identify what actions they want to perform.
3. Convert those actions into appropriate tool calls.
4. When closing a window, use the ID from the list of open windows.
5. Handle complex multi-command requests by breaking them into multiple tool calls.

For window operations:
- When opening windows, infer appropriate window types (sticky-note, notification, dialog, settings, general, lesson, quiz, hint, explainer)
- Extract relevant context like titles, content, and any positioning hints
- For sticky notes, use windowType "sticky-note" and include the note content in context.content
- For education intents:
  * "lesson" or "start lesson" → windowType "lesson"; set context.title and optional context.metadata.step
  * "quiz" → windowType "quiz"; set context.title from the prompt
  * "hint" → windowType "hint"; set context.title to the topic and context.content to the short hint text if provided
  * "explain" / "step by step" → windowType "explainer"; set context.title to the topic and include brief explanatory content if available

Few-shot guidance (intent → tool call shape):
- User: "start lesson \"Derivatives\" step 1" → open_window { windowType: "lesson", context: { title: "Derivatives", type: "lesson", metadata: { step: 1 } } }
- User: "open a quiz titled \"Chapter 3 Review\"" → open_window { windowType: "quiz", context: { title: "Chapter 3 Review", type: "quiz" } }
- User: "give me a hint about \"Pythagorean theorem\"" → open_window { windowType: "hint", context: { title: "Pythagorean theorem", content: "a^2 + b^2 = c^2", type: "hint" } }
- User: "explain \"binary search\" step by step" → open_window { windowType: "explainer", context: { title: "Binary search", type: "explainer" } }

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
