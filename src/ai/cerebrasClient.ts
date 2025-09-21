/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasRequest, CerebrasResponse, Tool, CerebrasTool } from './types';

export class CerebrasClient {
  // Client no longer holds API key; all calls go through server route
  constructor() {}

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


  async parseTextToTools(text: string, tools: Tool[], uiState: string): Promise<CerebrasResponse> {
    const systemPrompt = `You are a task extraction specialist for Jarvis. Convert the user command into a minimal, sequential list of tool calls using ONLY the listed tools.

ABSOLUTE OUTPUT CONTRACT (NO EXCEPTIONS):
- Respond with ONE valid JSON ARRAY only, with EXACTLY this shape:
  [ { "tool": string, "parameters": object } ]
- Do NOT include explanations, prose, markdown, code fences, logging, comments, or any other keys.
- If there are no actions, return exactly: []
- Each array item MUST include both keys: "tool" (string) and "parameters" (object).
- Keys must use double quotes. Do NOT use single quotes. Do NOT trail commas. Ensure strict JSON.

User command: \${text}

Available tools (reference only):
\${tools.map(tool => \`- \${tool.name}: \${tool.description}\`).join('\\n')}

Current UI state (reference for window IDs/titles):
\${uiState}

Decision Rules:
- Choose the most specific tool; use "search" only if no other tool fits.
- Parameters must match the tool schema exactly; omit optional fields unless clearly provided.
- Reference existing windows by ID if present in UI context; otherwise provide a reliable title match in parameters if supported.
- For multi-step intents, return multiple items in order.
- Return [] if the input is not actionable.

Examples (format is binding, values illustrative):
User: Analyze this PDF summary
Output: [{"tool":"analyze_pdf","parameters":{"prompt":"Summarize the document"}}]

User: Open web page https://x.com and view tasks
Output: [{"tool":"open_webview","parameters":{"url":"https://x.com"}},{"tool":"view_tasks","parameters":{}}]`;

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
      model: 'qwen-3-235b-a22b-instruct-2507',
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

  async extractTasksFromTranscript(transcript: string): Promise<{ tasks: string[]; remainder: string }> {
    const systemPrompt = [
      'You extract actionable commands from transcripts.',
      'ABSOLUTE OUTPUT CONTRACT (NO EXCEPTIONS): Return ONE strict JSON object with EXACTLY these keys and types:',
      '{ "tasks": string[], "remainder": string }',
      'Do NOT include explanations, prose, markdown, code fences, logging, comments, or additional keys.',
      'If no tasks, use tasks=[]. If no remainder, use remainder="". Use double quotes only; no trailing commas.'
    ].join(' ');

    const request: CerebrasRequest = {
      model: 'qwen-3-235b-a22b-instruct-2507',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      temperature: 0.1,
      max_tokens: 400
    };

    const response = await this.createChatCompletion(request);
    const content: unknown = response?.choices?.[0]?.message?.content;

    // The backend route used to do this parsing, but now that we are making the client responsible for it, we need to do it here.
    const coerceResult = (input: unknown): { tasks: string[]; remainder: string } => {
      const sanitizeTasks = (arr: unknown): string[] => {
        if (!Array.isArray(arr)) return [];
        const seen = new Set<string>();
        const out: string[] = [];
        for (const v of arr) {
          if (typeof v !== 'string') continue;
          const s = v.trim();
          if (!s) continue;
          const key = s.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(s.slice(0, 200));
        }
        return out.slice(0, 10);
      };
      const sanitizeRemainder = (text: unknown): string => {
        if (typeof text !== 'string') return '';
        const t = text.trim().replace(/\s+/g, ' ');
        if (!t) return '';
        if (t.length <= 2) return '';
        const lower = t.toLowerCase();
        const fillerTokens = ['uh','um','erm','hmm','like','you know','i mean','ok','okay','yeah','right','so','anyway','basically','kinda','sort of','sorta','yep','nope'];
        const tokens = lower.split(/\s+/);
        const fillerCount = tokens.filter(tok => fillerTokens.includes(tok)).length;
        if (tokens.length > 0 && (fillerCount / tokens.length) > 0.5) return '';
        const nonWordRatio = ((t.match(/[^a-zA-Z0-9\s.,;:!?'"()\-]/g) || []).length) / t.length;
        if (nonWordRatio > 0.2) return '';
        return t.slice(0, 400);
      };
      // Already JSON object
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        const obj = input as any;
        return {
          tasks: sanitizeTasks(obj.tasks),
          remainder: sanitizeRemainder(obj.remainder)
        };
      }
      // Try to extract JSON from a string
      if (typeof input === 'string') {
        const s = input.trim();
        try {
          const parsed = JSON.parse(s);
          return {
            tasks: sanitizeTasks((parsed as any)?.tasks),
            remainder: sanitizeRemainder((parsed as any)?.remainder)
          };
        } catch {
          const match = s.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              const parsed2 = JSON.parse(match[0]);
              return {
                tasks: sanitizeTasks((parsed2 as any)?.tasks),
                remainder: sanitizeRemainder((parsed2 as any)?.remainder)
              };
            } catch {
              // fallthrough
            }
          }
        }
      }
      return { tasks: [], remainder: '' };
    };

    return coerceResult(content);
  }
}
