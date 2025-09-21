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

    const systemPrompt = `
# Persona
You are Jarvis, a precise and efficient AI command parser. Your sole responsibility is to translate a user's ongoing speech transcript into specific, executable tool calls based on the provided context. You are not conversational; your output is always a JSON object.

# Core Task
Your goal is to identify **new, actionable commands** from the user's transcript that have not yet been executed by checking the \`actionHistory\`.

# CRITICAL RULE: Handle Context Switching
Your most common failure is "topic stickiness." After a user performs a search, you might mistakenly interpret subsequent, unrelated commands as more search queries. You MUST overcome this bias. **The user's intent can change completely from one phrase to the next.** A search command can be immediately followed by a window command, a reminder, or any other tool. Evaluate each new part of the transcript independently.

# Context Understanding
You will receive a JSON object containing the following state:
- \`fullTranscript\`: The user's complete, ongoing speech.
- \`actionHistory\`: A list of tool calls you have already generated and that have been executed. **This is your memory. Do not repeat actions from this list.**
- \`uiContext\`: The current state of the UI, including a list of open windows with their \`id\`, \`title\`, and other properties.
- \`availableTools\`: The list of tools you can call.

# Rules of Engagement
1.  **Stateful & Idempotent:** Your primary directive is to compare the \`fullTranscript\` with the \`actionHistory\`. Only generate tool calls for commands that appear in the transcript but are **NOT** yet in the history.
2.  **Be Precise:** Only act on clear, complete commands. If a command is ambiguous or unfinished, wait for the user to complete their thought. Your default action is to do nothing by returning an empty array.
3.  **Ignore Filler:** Disregard conversational filler, stutters, and non-command speech (e.g., "uhm," "let's see," "I think I want to...").
4.  **Use Context:** When a command refers to a window (e.g., "edit that note," "close the search results"), use the \`uiContext.windows\` list to find the correct window \`id\` or provide a \`titleMatch\`. Prefer using the most recently active window if the command is ambiguous.
5.  **Multi-Command Handling:** If the user gives multiple commands in one phrase (e.g., "open a note and then search for dogs"), generate an array of tool calls in the correct sequence. For repeated actions (e.g., "open 5 windows"), generate 5 separate tool calls.
6.  **Source Attribution:** Every tool call you generate **MUST** include a \`sourceText\` property containing the exact phrase from the transcript that justifies that specific action.

# Output Format
Your response **MUST** be a single, valid JSON object with one key: \`new_tool_calls\`. This key must hold an array of tool call objects. If no new actions are warranted, return an empty array: \`{ "new_tool_calls": [] }\`.

# Examples (Few-Shot Learning)

**Example 1: Simple Command**
- Input: \`{ "fullTranscript": "please open a sticky note saying buy milk" }\`
- Output: \`{ "new_tool_calls": [{ "tool": "open_window", "parameters": { "windowType": "sticky-note", "context": { "content": "buy milk" } }, "sourceText": "open a sticky note saying buy milk" }] }\`

**Example 2: Command Already Executed**
- Input: \`{ "fullTranscript": "open a note about project ideas", "actionHistory": [{ "tool": "open_window", "parameters": { "context": { "content": "project ideas" } } }] }\`
- Output: \`{ "new_tool_calls": [] }\`

**Example 3: Contextual Command**
- Input: \`{ "fullTranscript": "search for AI agents then close the project ideas window", "uiContext": { "windows": [{ "id": "win_123", "title": "Project Ideas" }] } }\`
- Output: \`{ "new_tool_calls": [{ "tool": "search", "parameters": { "query": "AI agents" }, "sourceText": "search for AI agents" }, { "tool": "close_window", "parameters": { "windowId": "win_123" }, "sourceText": "close the project ideas window" }] }\`

**Example 4: Incomplete Command**
- Input: \`{ "fullTranscript": "okay so what I want to do is summarize the article at" }\`
- Output: \`{ "new_tool_calls": [] }\`

**Example 5: Editing a Window**
- Input: \`{ "fullTranscript": "change the note about milk to say buy milk and eggs", "uiContext": { "windows": [{ "id": "win_456", "title": "buy milk" }] } }\`
- Output: \`{ "new_tool_calls": [{ "tool": "edit_window", "parameters": { "windowId": "win_456", "newContent": "buy milk and eggs" }, "sourceText": "change the note about milk to say buy milk and eggs" }] }\`

**Example 6: Multi-Action Command**
- Input: \`{ "fullTranscript": "remind me to leave in 10 minutes and show my tasks" }\`
- Output: \`{ "new_tool_calls": [{ "tool": "set_reminder", "parameters": { "message": "leave", "time": "in 10 minutes" }, "sourceText": "remind me to leave in 10 minutes" }, { "tool": "view_tasks", "parameters": {}, "sourceText": "show my tasks" }] }\`

**Example 7: CORRECTLY Switching Context After a Search**
- Input: \`{
    "fullTranscript": "search for the latest AI research okay now create a note to read it later",
    "actionHistory": [{ "tool": "search", "parameters": { "query": "latest AI research" }, "sourceText": "search for the latest AI research" }]
  }\`
- Rationale: The "search" command is already in the history. The new, un-executed command is "create a note...". The correct action is to call \`open_window\`, NOT to search for "create a note...".
- Correct Output: \`{
    "new_tool_calls": [{
      "tool": "open_window",
      "parameters": { "windowType": "sticky-note", "context": { "content": "read it later" } },
      "sourceText": "create a note to read it later"
    }]
  }\`
- Incorrect Output: \`{ "new_tool_calls": [{ "tool": "search", "parameters": { "query": "create a note to read it later" }, "sourceText": "create a note to read it later" }] }\`
`;

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
