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


  async parseTextToTools(text: string, tools: Tool[], uiState: string): Promise<CerebrasResponse> {
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
6. Do not invent placeholder content like "hello world" or "none". If content is unspecified, leave context.content empty.

For window operations:
- When opening windows, infer appropriate window types (sticky-note, notification, dialog, settings, general, lesson, quiz, hint, explainer)
- When user asks to organize, arrange, tidy up, optimize, or clean up windows, use the organize_windows tool
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
- User: "open 5 windows saying hello" → [create 5 separate open_window calls with same content "hello"]
- User: "close all windows" → close_window { selector: "all" }
- User: "organize the windows" → organize_windows {}
- User: "arrange all windows" → organize_windows {}
- User: "tidy up the screen" → organize_windows {}
- User: "optimize window layout" → organize_windows {}

IMPORTANT: When user asks to open multiple windows (e.g., "open 5 windows"), create multiple separate tool calls, one for each window.

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
      'Respond with ONLY a single JSON object: {"tasks": string[], "remainder": string}.',
      'Do not include any prose, code fences, or extra text before/after the JSON.',
      'Be aggressive about filtering out irrelevant, random, or filler text; prefer remainder="" unless clearly a partial command.'
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
