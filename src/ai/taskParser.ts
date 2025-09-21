
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CerebrasClient } from './cerebrasClient';
import { AVAILABLE_TOOLS } from './tools';
import { Task, AIProcessingResult } from './types';

export class TaskParser {
  private cerebrasClient: CerebrasClient;

  constructor(apiKey?: string) {
    this.cerebrasClient = new CerebrasClient(apiKey);
  }

  async parseTextToTasks(text: string, uiContext: any = {}): Promise<AIProcessingResult> {
    console.log(`[TaskParser] Processing: ${text}`);
    try {
      const startTime = Date.now();
      console.log('[TaskParser] parseTextToTasks called', {
        textPreview: typeof text === 'string' ? text.slice(0, 80) : typeof text,
        uiWindows: Array.isArray(uiContext?.windows) ? uiContext.windows.length : 0
      });
      
      // Early handling: if the command is clearly a close/dismiss intent,
      // short-circuit Cerebras and return a direct close task to avoid
      // the model turning it into a note.
      const earlyClose = this.detectCloseCommand(text);
      if (earlyClose.length > 0) {
        return {
          success: true,
          tasks: earlyClose,
          timestamp: Date.now() - startTime
        };
      }

      // Use Cerebras to process the natural language input
      const response = await this.cerebrasClient.processTextToTasks(text, AVAILABLE_TOOLS, uiContext);
      console.log('[TaskParser] Cerebras response received', {
        hasChoices: Boolean((response as any)?.choices?.length),
        toolCalls: ((response as any)?.choices?.[0]?.message?.tool_calls || []).length
      });
      
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

      // Guardrail: only allow web_search if the user explicitly asked to search
      const hasSearchKeyword = /\b(search|look up|find information|google|bing)\b/i.test(text);
      tasks = tasks.filter(t => t.tool !== 'web_search' || hasSearchKeyword);

      // Force-correct: if the user asked to open a result but the model returned a generic window,
      // replace/augment with open_search_result so UI opens the article.
      const openResultIndex = this.detectOpenResultIndex(text);
      if (openResultIndex != null) {
        // Drop any generic First Link windows the model may have created
        tasks = tasks.filter(t => !(t.tool === 'open_window' && /first\s+link/i.test(String((t as any)?.parameters?.context?.title || ''))));
        // Only add if not already present
        if (!tasks.some(t => t.tool === 'open_search_result')) {
          tasks.unshift({
            id: this.generateTaskId(),
            tool: 'open_search_result',
            parameters: { index: openResultIndex },
            description: `Open search result #${openResultIndex}`
          });
        }
      }

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
      try {
        console.log('[TaskParser] Falling back to local parsing for input');
      } catch {}
      
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

  private detectOpenResultIndex(text: string): number | null {
    const lower = text.toLowerCase();
    // quick patterns: first/second/third/fourth/fifth
    const wordToIndex: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    const word = lower.match(/\b(first|second|third|fourth|fifth)\b/);
    if (word) return wordToIndex[word[1]];
    const num = lower.match(/result\s*(\d+)/);
    if (num) return Math.max(1, parseInt(num[1], 10));
    if (/\b(open|read|show|load|click)\b\s+(it|this|that)/i.test(lower)) return 1; // default
    return null;
  }

  private detectCloseCommand(text: string): Task[] {
    try {
      const lower = text.toLowerCase();
      const hasCloseVerb = /(close|dismiss|hide|remove|exit|quit|shut|shutdown|shut\s*down)/i.test(lower);
      const mentionsWindow = /(window|popup|dialog|note|all\s+windows|windows)/i.test(lower);
      const pronounTarget = /(\bthis\b|\bcurrent\b|\bfocused\b|\bit\b|\bthat\b)/i.test(lower);
      if (!hasCloseVerb) return [];
      
      // Must have close verb AND (window mention OR pronoun target)
      if (!mentionsWindow && !pronounTarget) return [];

      // Selector-based phrases
      let selector: 'newest' | 'latest' | 'oldest' | 'active' | 'all' | undefined;
      if (/\b(newest|latest)\b/i.test(text)) selector = 'newest';
      else if (/\boldest\b/i.test(text)) selector = 'oldest';
      else if (pronounTarget || /\bcurrent\b|\bfocused\b/i.test(text)) selector = 'active';
      else if (/\b(all\s+windows|close\s+all|close\s+everything|dismiss\s+all)\b/i.test(lower)) selector = 'all';

      // Direct ID patterns (e.g., "close window abc123")
      // Capture an identifier following the window keyword or at the end
      let windowId: string | undefined;
      const idPatterns: RegExp[] = [
        /(?:close|dismiss|hide|shut(?:\s*down)?)\s+(?:the\s+)?(?:window|popup|dialog|note)\s+([A-Za-z0-9_-]+)/i,
        /(?:window|popup|dialog|note)\s+([A-Za-z0-9_-]+)\s*(?:please)?\s*(?:close|dismiss|hide|shut(?:\s*down)?)?/i,
      ];
      for (const p of idPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
          windowId = m[1].trim();
          break;
        }
      }

      // If we only have a close intent with no id/selector, default to newest
      if (!windowId && !selector && hasCloseVerb) selector = 'newest';

      if (!windowId && !selector) return [];

      const params: any = {};
      if (windowId) params.windowId = windowId;
      if (selector) params.selector = selector;

      return [
        {
          id: this.generateTaskId(),
          tool: 'close_window',
          parameters: params,
          description: this.generateTaskDescription('close_window', params)
        }
      ];
    } catch {
      return [];
    }
  }

  private fallbackParsing(text: string): Task[] {
    console.log(`[TaskParser] Fallback parsing: ${text}`);
    const tasks: Task[] = [];
    const lowerText = text.toLowerCase();
    
    // Search commands (handle first to avoid creating a generic open window)
    if (lowerText.includes('search') || lowerText.includes('look up') || lowerText.includes('find information') || /article/i.test(lowerText)) {
      let searchQuery = '';
      let resultCount = 5;
      let displayMode = 'auto';

      const searchPatterns = [
        /search\s+for\s+(.+?)$/i,
        /look\s+up\s+(.+?)$/i,
        /find\s+information\s+(?:about|on)\s+(.+?)$/i,
        /(?:search|look\s+up|find)\s+["']([^"']+)["']/i,
        /(?:search|google|bing)\s*[:.]?\s*(.+?)$/i
      ];

      for (const pattern of searchPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          searchQuery = match[1].trim();
          break;
        }
      }

      const countMatch = text.match(/(\d+)\s+(?:results?|top|first)/i);
      if (countMatch) {
        const n = parseInt(countMatch[1], 10);
        if (!isNaN(n) && n > 0 && n <= 10) resultCount = n;
      }

      if (searchQuery) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'web_search',
          parameters: {
            query: searchQuery,
            resultCount: resultCount,
            displayMode: displayMode
          },
          description: `Search for: ${searchQuery}`
        });

        // Fallback: if no tasks and it mentions search/article, force a search task
        if (tasks.length === 0 && (/\b(search|look up|find information|article)\b/i.test(text))) {
          console.log(`[TaskParser] Forcing search for: ${text}`);
          tasks.push({
            id: this.generateTaskId(),
            tool: 'web_search',
            parameters: { query: text, resultCount: 5, displayMode: 'links' },
            description: `Search for: ${text}`
          });
        }

        return tasks; // Do not create a generic open window
      }
    }

    // Image analyze commands
    if (/(analyze|describe|ocr)\s+(this\s+)?image/i.test(lowerText)) {
      tasks.push({ id: this.generateTaskId(), tool: 'analyze_image', parameters: {}, description: 'Analyze image' });
      return tasks;
    }

    // PDF analyze commands
    if (/(analyze|summarize)\s+(this\s+)?pdf/i.test(lowerText)) {
      tasks.push({ id: this.generateTaskId(), tool: 'analyze_pdf', parameters: {}, description: 'Analyze PDF' });
      return tasks;
    }

    // Task creation: "add task buy milk due tomorrow"
    if (/\b(add|create|new)\s+task\b/i.test(lowerText)) {
      const titleMatch = text.match(/task\s*[:\-]?\s*(.+?)(?:\s+due\s+([^\n]+))?$/i);
      const title = titleMatch ? (titleMatch[1] || '').trim() : '';
      const due = titleMatch && titleMatch[2] ? titleMatch[2].trim() : undefined;
      if (title) {
        tasks.push({ id: this.generateTaskId(), tool: 'create_task', parameters: { title, due }, description: `Create task: ${title}` });
        return tasks;
      }
    }

    // View tasks
    if (/(show|view|list)\s+(my\s+)?tasks/i.test(lowerText)) {
      tasks.push({ id: this.generateTaskId(), tool: 'view_tasks', parameters: {}, description: 'View tasks' });
      return tasks;
    }

    // Reminders
    if (/\b(remind\s+me\b|set\s+reminder\b)/i.test(lowerText)) {
      const msgMatch = text.match(/remind\s+me\s+(?:to\s+)?(.+?)\s+(?:at|on|in)\s+(.+)$/i) || text.match(/set\s+reminder\s+for\s+(.+?)\s+(?:at|on|in)\s+(.+)$/i);
      if (msgMatch) {
        const message = (msgMatch[1] || '').trim();
        const time = (msgMatch[2] || '').trim();
        if (message && time) {
          tasks.push({ id: this.generateTaskId(), tool: 'set_reminder', parameters: { message, time }, description: `Remind: ${message} @ ${time}` });
          return tasks;
        }
      }
    }

    // Weather
    if (/\b(weather|forecast)\b/i.test(lowerText)) {
      // Try multiple patterns to extract location
      let location = '';
      const patterns = [
        /(?:weather|forecast)(?:\s+in|\s+for)?\s+([A-Za-z\s,]+?)(?:\s|$)/i,
        /(?:in|for)\s+([A-Za-z\s,]+?)(?:\s+weather|\s+forecast|$)/i,
        /weather.*?(?:in|for)\s+([A-Za-z\s,]+)/i
      ];
      
      for (const pattern of patterns) {
        const m = text.match(pattern);
        if (m && m[1]) {
          location = m[1].trim();
          break;
        }
      }
      
      // Default to New York if no location found
      if (!location) location = 'New York';
      
      tasks.push({ id: this.generateTaskId(), tool: 'get_weather', parameters: { location }, description: `Weather in ${location}` });
      return tasks;
    }

    // News
    if (/\b(news|headlines)\b/i.test(lowerText)) {
      const m = text.match(/(?:about|on|for)\s+(.+)$/i);
      const query = m ? m[1].trim() : '';
      if (query) {
        tasks.push({ id: this.generateTaskId(), tool: 'get_news', parameters: { query, pageSize: 5 }, description: `News: ${query}` });
        return tasks;
      }
    }

    // Stocks
    if (/\b(stock|stocks|ticker|price)\b/i.test(lowerText)) {
      const m = text.match(/\b([A-Z]{1,5})\b/);
      const symbol = m ? m[1] : '';
      if (symbol) {
        tasks.push({ id: this.generateTaskId(), tool: 'get_stocks', parameters: { symbol }, description: `Stock: ${symbol}` });
        return tasks;
      }
    }

    // Open specific result commands
    if (/\b(open|read|show|load|click)\b\s+(it|this|that|first|second|third|fourth|fifth|result\s*\d+|the\s+first\s+(link|result))/i.test(lowerText)) {
      let index = 1;
      const indexMap: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
      const idxWord = (lowerText.match(/(first|second|third|fourth|fifth)/)?.[1]);
      if (idxWord) index = indexMap[idxWord] || 1;
      const idxNum = (lowerText.match(/result\s*(\d+)/)?.[1]);
      if (idxNum) index = Math.max(1, parseInt(idxNum, 10));
      // Pragmatic default for "open it/this/that"
      if (/(\bit\b|\bthis\b|\bthat\b)/i.test(lowerText) && !idxWord && !idxNum) index = 1;

      tasks.push({
        id: this.generateTaskId(),
        tool: 'open_search_result',
        parameters: { index },
        description: `Open search result #${index}`
      });
      return tasks;
    }

    // Open/create commands
    if (lowerText.includes('open') || lowerText.includes('create') || lowerText.includes('show') || lowerText.includes('start')) {
      let windowType = 'general';
      let content = '';
      let metadata: Record<string, any> | undefined = undefined;
      let count = 1;
      
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

      // Parse counts: e.g., "open 7 windows saying cheese", "open seven windows" (basic digits only here)
      const countMatch = text.match(/open\s+(\d{1,2})\s+(?:window|windows)/i);
      if (countMatch) {
        const n = parseInt(countMatch[1], 10);
        if (!Number.isNaN(n) && n > 1 && n <= 20) count = n;
      }
      
      // Generic content extraction for phrases like: say "...", with content "...", display "..."
      if (!content) {
        const sayPattern = /(?:say|that\s+says|saying|with\s+(?:content|text)|message|display|show\s+text)\s*["']([^"']+)["']/i;
        const sayMatch = text.match(sayPattern);
        if (sayMatch) {
          content = sayMatch[1].trim();
        }
      }

      // Unquoted say/saying patterns: capture text after say/saying until end
      if (!content) {
        const sayPlainPattern = /(?:say|saying|that\s+says)\s+(.+?)$/i;
        const sayPlainMatch = text.match(sayPlainPattern);
        if (sayPlainMatch) {
          content = sayPlainMatch[1].trim();
        }
      }

      // Fallback: if still no content, use first quoted string in the command as content
      if (!content) {
        const anyQuoteMatch = text.match(/"([^\"]+)"|'([^']+)'/);
        if (anyQuoteMatch) {
          content = (anyQuoteMatch[1] || anyQuoteMatch[2] || '').trim();
        }
      }

      for (let i = 0; i < count; i++) {
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
    }

    // Edit window intents: rename/set/append/prepend/clear content
    if (/(rename|retitle|change\s+title)/i.test(lowerText)) {
      const m = text.match(/(?:to|as)\s+"([^"]+)"|(?:to|as)\s+'([^']+)'|(?:to|as)\s+(.+)$/i);
      const newTitle = m ? (m[1] || m[2] || m[3] || '').trim() : '';
      if (newTitle) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'edit_window',
          parameters: { selector: 'active', title: newTitle },
          description: `Rename active window to ${newTitle}`
        });
        return tasks;
      }
    }

    if (/(append|add\s+to|add\s+into)/i.test(lowerText)) {
      const m = text.match(/(?:append|add(?:\s+to|\s+into)?)\s+"([^"]+)"|(?:append|add(?:\s+to|\s+into)?)\s+'([^']+)'|(?:append|add(?:\s+to|\s+into)?)\s+(.+)$/i);
      const txt = m ? (m[1] || m[2] || m[3] || '').trim() : '';
      if (txt) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'edit_window',
          parameters: { selector: 'active', content: txt, mode: 'append' },
          description: `Append to active window`
        });
        return tasks;
      }
    }

    if (/(set|replace)\s+(content|text)/i.test(lowerText)) {
      const m = text.match(/(?:set|replace)\s+(?:content|text)\s+to\s+"([^"]+)"|(?:set|replace)\s+(?:content|text)\s+to\s+'([^']+)'|(?:set|replace)\s+(?:content|text)\s+to\s+(.+)$/i);
      const txt = m ? (m[1] || m[2] || m[3] || '').trim() : '';
      if (txt) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'edit_window',
          parameters: { selector: 'active', content: txt, mode: 'set' },
          description: `Set content of active window`
        });
        return tasks;
      }
    }

    if (/(prepend)/i.test(lowerText)) {
      const m = text.match(/prepend\s+"([^"]+)"|prepend\s+'([^']+)'|prepend\s+(.+)$/i);
      const txt = m ? (m[1] || m[2] || m[3] || '').trim() : '';
      if (txt) {
        tasks.push({
          id: this.generateTaskId(),
          tool: 'edit_window',
          parameters: { selector: 'active', content: txt, mode: 'prepend' },
          description: `Prepend to active window`
        });
        return tasks;
      }
    }

    if (/(clear|empty|wipe)\s+(window|content|text)/i.test(lowerText)) {
      tasks.push({
        id: this.generateTaskId(),
        tool: 'edit_window',
        parameters: { selector: 'active', mode: 'clear' },
        description: `Clear active window`
      });
      return tasks;
    }

    // Group management commands
    if (/(create|make|new)\s+group/i.test(lowerText)) {
      const groupMatch = text.match(/(?:create|make|new)\s+group\s+(?:called\s+)?["']?([^"']+?)["']?(?:\s*(?:,|and)?\s*(?:make\s+it\s+)?(?:the\s+)?(?:color|with\s+color)\s+([a-zA-Z#]+))?/i);
      if (groupMatch) {
        const name = groupMatch[1].trim();
        const color = groupMatch[2] || 'blue';
        tasks.push({
          id: this.generateTaskId(),
          tool: 'create_group',
          parameters: { name, color },
          description: `Create group: ${name} (${color})`
        });
      }
    }

    if (lowerText.includes('move') && (lowerText.includes('to group') || lowerText.includes('group'))) {
      const moveMatch = text.match(/move\s+(?:(?:this|the|current)\s+)?(?:window\s+)?(?:to\s+)?group\s+["']?([^"']+?)["']?/i);
      if (moveMatch) {
        const groupName = moveMatch[1].trim();
        tasks.push({
          id: this.generateTaskId(),
          tool: 'assign_group',
          parameters: { groupName, selector: 'newest' },
          description: `Move window to group: ${groupName}`
        });
      }
    }
    
    return tasks;
  }

  private extractTitle(text: string): string | null {
    // Extract title ONLY when explicitly specified with keywords like 'titled', 'called', 'named'
    // Do NOT extract quotes as titles - let content extraction handle those
    const titlePatterns = [
      /titled\s+["']?([^"']+?)["']?(?:\s+window|$)/i,
      /called\s+["']?([^"']+?)["']?(?:\s+window|$)/i,
      /named\s+["']?([^"']+?)["']?(?:\s+window|$)/i,
      /title\s+["']?([^"']+?)["']?(?:\s+window|$)/i,
      /with\s+title\s+["']?([^"']+?)["']?(?:\s+window|$)/i
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
