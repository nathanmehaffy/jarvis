/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasClient } from './cerebrasClient';
import { AVAILABLE_TOOLS } from './tools';

export class TaskParser {
  private cerebrasClient: CerebrasClient;

  constructor() {
    this.cerebrasClient = new CerebrasClient();
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

    const systemPrompt = `You are a precise task parser for Jarvis, an AI desktop assistant. Convert user input into executable tool calls using ONLY the available tools.

ABSOLUTE OUTPUT CONTRACT (NO EXCEPTIONS):
- Respond with ONE valid JSON OBJECT only, with EXACTLY this top-level shape:
  { "new_tool_calls": [ { "tool": string, "parameters": object, "sourceText": string } ] }
- Do NOT include explanations, prose, markdown, code fences, logging, comments, or any other keys.
- If there are no actions, return exactly: { "new_tool_calls": [] }
- Each array item MUST include all three keys: "tool" (string), "parameters" (object), "sourceText" (string).
- Keys must use double quotes. Do NOT use single quotes. Do NOT trail commas. Ensure strict JSON.

Available tools (reference only): provided in user payload under "availableTools"

Decision Rules:
- Use the most specific tool available. Use "search" only when no specific tool is appropriate.
- Match parameter names and types to the tool schema exactly. Omit optional params rather than guessing.
- Use UI context when referring to windows (prefer windowId; otherwise provide a reliable title match).
- For multi-step intents, output multiple items in order.
- If input is unclear or impossible, return { "new_tool_calls": [] }.

Examples (format is binding, values are illustrative):
User: Open a window with hello world
Output: {"new_tool_calls":[{"tool":"open_window","parameters":{"content":"hello world","title":"Hello"},"sourceText":"Open a window with hello world"}]}

User: Search for cute cats and open the first result
Output: {"new_tool_calls":[{"tool":"search","parameters":{"query":"cute cats"},"sourceText":"Search for cute cats"},{"tool":"open_search_result","parameters":{"index":1},"sourceText":"open the first result"}]}

User: Summarize this article: https://example.com
Output: {"new_tool_calls":[{"tool":"summarize_article","parameters":{"url":"https://example.com"},"sourceText":"Summarize this article: https://example.com"}]}

User: Remind me to buy milk tomorrow
Output: {"new_tool_calls":[{"tool":"create_task","parameters":{"title":"Buy milk","due":"tomorrow"},"sourceText":"Remind me to buy milk tomorrow"}]}

User: Close the notes window (UI context has window with title 'Notes')
Output: {"new_tool_calls":[{"tool":"close_window","parameters":{"windowId":"notes-window-id"},"sourceText":"Close the notes window"}]}

User: What's the weather? (No specific tool, fallback to search)
Output: {"new_tool_calls":[{"tool":"search","parameters":{"query":"current weather"},"sourceText":"What's the weather?"}]}`;

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

    const llmCalls = coerce(content).new_tool_calls;

    // Local fallbacks: detect common edit-window phrasing to avoid depending solely on LLM
    const localCalls: Array<{ tool: string; parameters: any; sourceText: string }> = [];

    const detectLocalEdits = (text: string) => {
      const raw = text;

      const pushCall = (params: any, source: string) => {
        localCalls.push({ tool: 'edit_window', parameters: params, sourceText: source });
      };

      // 1) edit window "Title" to say ... / to ...
      const reQuoted = /edit\s+(?:the\s+)?window\s+"([^"]+)"\s+(?:to\s+(?:say\s+)?)((?:.|\n|\r)+)$/i;
      const mQuoted = raw.match(reQuoted);
      if (mQuoted) {
        const [, title, newText] = mQuoted;
        const contentText = newText.trim();
        if (contentText) pushCall({ titleMatch: title, newContent: contentText }, mQuoted[0]);
      }

      // 2) edit the window about X to say ... / to ...
      const reAbout = /edit\s+(?:the\s+)?window\s+about\s+([a-z0-9\-\s]+?)\s+(?:to\s+(?:say\s+)?)((?:.|\n|\r)+)$/i;
      const mAbout = raw.match(reAbout);
      if (mAbout) {
        const [, about, newText] = mAbout;
        const contentText = newText.trim();
        if (contentText) pushCall({ titleMatch: `window ${about.trim()}` }, mAbout[0]);
        if (contentText) {
          // include newContent
          localCalls[localCalls.length - 1].parameters.newContent = contentText;
        }
      }

      // 3) change/edit window "Title" title to NewTitle
      const reTitleQuoted = /(edit|change)\s+(?:the\s+)?window\s+"([^"]+)"\s+(?:title|name)\s+to\s+(.+)$/i;
      const mTitleQ = raw.match(reTitleQuoted);
      if (mTitleQ) {
        const [, , title, newTitle] = mTitleQ;
        const nt = newTitle.trim();
        if (nt) pushCall({ titleMatch: title, newTitle: nt }, mTitleQ[0]);
      }

      // 4) change/edit the window about X title to NewTitle
      const reTitleAbout = /(edit|change)\s+(?:the\s+)?window\s+about\s+([a-z0-9\-\s]+?)\s+(?:title|name)\s+to\s+(.+)$/i;
      const mTitleA = raw.match(reTitleAbout);
      if (mTitleA) {
        const [, , about, newTitle] = mTitleA;
        const nt = newTitle.trim();
        if (nt) pushCall({ titleMatch: `window ${about.trim()}`, newTitle: nt }, mTitleA[0]);
      }
    };

    detectLocalEdits(fullTranscript);

    // Deduplicate against actionHistory and llm calls
    const seenKeys = new Set<string>(
      (Array.isArray(actionHistory) ? actionHistory : []).map(a => {
        try { return `${a.tool}:${JSON.stringify(a.parameters || {})}`; } catch { return `${a.tool}:x`; }
      })
    );

    const merge = (arr: Array<{ tool: string; parameters: any; sourceText: string }>) => arr.filter(c => {
      try {
        const key = `${c.tool}:${JSON.stringify(c.parameters || {})}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      } catch { return true; }
    });

    const merged = [...merge(localCalls), ...merge(llmCalls)];

    console.log('🔧 [TaskParser] LLM Response coerced to result', {
      rawContent: content,
      llmCalls: llmCalls.length,
      localCalls: localCalls.length,
      mergedCalls: merged.length,
      timestamp: new Date().toISOString()
    });

    // Fallback parsing for search commands if no tool calls found
    let finalResult = { new_tool_calls: merged };
    if (finalResult.new_tool_calls.length === 0) {
      console.log('🔍 [TaskParser] No tool calls from LLM or local parsing, trying fallback search parsing');
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
          finalResult = {
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
      finalResult: finalResult,
      toolCallsToExecute: finalResult.new_tool_calls.length,
      timestamp: new Date().toISOString()
    });

    return finalResult;
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
