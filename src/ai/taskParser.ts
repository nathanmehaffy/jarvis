/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasClient } from './cerebrasClient';
import { AVAILABLE_TOOLS } from './tools';

export class TaskParser {
  private cerebrasClient: CerebrasClient;

  constructor() {
    this.cerebrasClient = new CerebrasClient();
  }

  async parseTextToTasks(input: { transcript: string; actionHistory: Array<{ tool: string; parameters: any; sourceText: string }>; uiContext: any }): Promise<{ new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }>; conversational_response?: string }> {
    const fullTranscript = (input?.transcript || '').toString();
    const uiContext = input?.uiContext || {};
    const actionHistory = Array.isArray(input?.actionHistory) ? input.actionHistory : [];

    // Extract the most recent user input (assuming it's at the end of the transcript)
    const sentences = fullTranscript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const recentInput = sentences.length > 0 ? sentences[sentences.length - 1].trim() : fullTranscript;

    console.log('🔍 [TaskParser] parseTextToTasks STARTED', {
      fullTranscript: fullTranscript,
      transcriptLength: fullTranscript.length,
      recentInput: recentInput,
      transcriptPreview: fullTranscript.slice(-120),
      uiWindows: Array.isArray(uiContext?.windows) ? uiContext.windows.length : 0,
      actionCount: actionHistory.length,
      actionHistory: actionHistory,
      timestamp: new Date().toISOString()
    });

    const systemPrompt = `You are a precise task parser for Jarvis, an AI desktop assistant. Convert user input into executable tool calls using ONLY the available tools.

ABSOLUTE OUTPUT CONTRACT (NO EXCEPTIONS):
- Respond with ONE valid JSON OBJECT only, with EXACTLY this top-level shape:
  { "new_tool_calls": [ { "tool": string, "parameters": object, "sourceText": string } ], "conversational_response": string }
- Do NOT include explanations, prose, markdown, code fences, logging, comments, or any other keys beyond these two.
- If there are no actions, return exactly: { "new_tool_calls": [] }
- Each array item MUST include all three keys: "tool" (string), "parameters" (object), "sourceText" (string).
- Keys must use double quotes. Do NOT use single quotes. Do NOT trail commas. Ensure strict JSON.
- OPTIONAL: Include "conversational_response" ONLY for direct questions, greetings, or when no tool calls are possible. Do NOT use for action confirmations - actions speak for themselves. This will appear as a temporary chat popup at the bottom of the screen.

Available tools (reference only): provided in user payload under "availableTools"

Decision Rules:
- Prioritize the most recent user command. The last line of the transcript is the most important.
- NEVER search the entire conversation history verbatim. Always extract a concise search query.
- Use the most specific tool available. Use "search" only when no specific tool is appropriate.
- If an imperative/command-like phrase follows a search directive, DO NOT append it to the search query; treat it as a separate tool call unless the user explicitly instructs to include it inside the query (e.g., "search for 'X then Y' as one query").
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

User: How are you doing?
Output: {"new_tool_calls":[],"conversational_response":"I'm doing great! Ready to help you with any tasks or questions you might have."}

User: Close the notes window (UI context has window with title 'Notes')
Output: {"new_tool_calls":[{"tool":"close_window","parameters":{"windowId":"notes-window-id"},"sourceText":"Close the notes window"}]}

User: What's the weather? (No specific tool, fallback to search)
Output: {"new_tool_calls":[{"tool":"search","parameters":{"query":"current weather"},"sourceText":"What's the weather?"}]}

User: search for potato nutrition then create a note saying buy potatoes
Output: {"new_tool_calls":[{"tool":"search","parameters":{"query":"potato nutrition"},"sourceText":"search for potato nutrition"},{"tool":"open_window","parameters":{"windowType":"sticky-note","context":{"content":"buy potatoes"}},"sourceText":"create a note saying buy potatoes"}]}`

    const jsonPayload = {
      fullTranscript: fullTranscript,
      recentInput: recentInput,
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

    const coerce = (input: unknown): { new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }>; conversational_response?: string } => {
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

        const result: { new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }>; conversational_response?: string } = { new_tool_calls: cleaned };

        // Include conversational response if present
        if (typeof (obj as any).conversational_response === 'string' && (obj as any).conversational_response.trim()) {
          result.conversational_response = (obj as any).conversational_response.trim();
        }

        return result;
      } catch {
        return empty;
      }
    };

    const llmResult = coerce(content);
    const llmCalls = llmResult.new_tool_calls;
    const conversationalResponse = llmResult.conversational_response;

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

    const detectLocalGroups = (text: string) => {
      const lower = text.toLowerCase();
      // create/make category/group <name>
      let m = lower.match(/(?:create|make|add)\s+(?:a\s+)?(?:category|group)\s+([a-z0-9\-\s]+)/i);
      if (m && m[1]) {
        localCalls.push({ tool: 'create_group', parameters: { name: m[1].trim() }, sourceText: m[0] });
      }
      // assign (this|active) to <name>
      m = lower.match(/assign\s+(?:this|window|active)?\s*(?:window)?\s*(?:to|into)\s+([a-z0-9\-\s]+)/i);
      if (m && m[1]) {
        localCalls.push({ tool: 'assign_group', parameters: { groupName: m[1].trim(), selector: 'active' }, sourceText: m[0] });
      }
      // collapse <name> group/category
      m = lower.match(/collapse\s+(?:the\s+)?([a-z0-9\-\s]+)\s*(?:group|category)?/i);
      if (m && m[1]) {
        localCalls.push({ tool: 'collapse_group', parameters: { groupName: m[1].trim() }, sourceText: m[0] });
      }
      // expand <name> group/category
      m = lower.match(/expand\s+(?:the\s+)?([a-z0-9\-\s]+)\s*(?:group|category)?/i);
      if (m && m[1]) {
        localCalls.push({ tool: 'expand_group', parameters: { groupName: m[1].trim() }, sourceText: m[0] });
      }
    };

    detectLocalEdits(fullTranscript);
    detectLocalGroups(fullTranscript);

    // Deduplicate against actionHistory and llm calls
    const seenKeys = new Set<string>(
      (Array.isArray(actionHistory) ? actionHistory : []).map(a => {
        try { return `${a.tool}:${JSON.stringify(a.parameters || {})}`; } catch { return `${a.tool}:x`; }
      })
    );

    const merge = (arr: Array<{ tool: string; parameters: any; sourceText: string }>) => arr.filter(c => {
      try {
        if (c.tool === 'close_window' && c.parameters?.selector === 'all') {
          return true;
        }
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
    let finalResult: { new_tool_calls: Array<{ tool: string; parameters: any; sourceText: string }>; conversational_response?: string } = {
      new_tool_calls: merged,
      conversational_response: conversationalResponse
    };
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
            }],
            conversational_response: conversationalResponse
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
