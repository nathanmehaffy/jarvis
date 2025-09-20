import { Tool } from './types';

export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: 'open_window',
    description: 'Opens a new popup window with specified type and context. Use this for creating, opening, showing, or displaying a window. Education types supported: lesson, quiz, hint, explainer.',
    parameters: {
      type: 'object',
      properties: {
        windowType: {
          type: 'string',
          description: 'The type of window to open (e.g., notification, dialog, settings, sticky-note, general, lesson, quiz, hint, explainer)'
        },
        context: {
          type: 'object',
          description: 'Context information for the window',
          properties: {
            title: {
              type: 'string',
              description: 'Window title to display'
            },
            content: {
              type: 'string',
              description: 'Primary text/content of the window'
            },
            type: {
              type: 'string',
              description: 'Repeat of window type for UI context (notification, dialog, settings, sticky-note, general, lesson, quiz, hint, explainer)'
            },
            position: {
              type: 'object',
              description: 'Optional x/y position of the window',
              properties: {
                x: { type: 'number', description: 'X coordinate in pixels' },
                y: { type: 'number', description: 'Y coordinate in pixels' }
              }
            },
            size: {
              type: 'object',
              description: 'Optional width/height of the window',
              properties: {
                width: { type: 'number', description: 'Window width in pixels' },
                height: { type: 'number', description: 'Window height in pixels' }
              }
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata for education windows (e.g., lessonId, step, quizQuestions)',
              properties: {}
            }
          }
        }
      },
      required: ['windowType', 'context']
    }
  },
  {
    name: 'edit_window',
    description: 'Edits an existing window: rename title, set/append/prepend/clear content.',
    parameters: {
      type: 'object',
      properties: {
        windowId: { type: 'string', description: 'Target window id (optional if selector used)' },
        selector: { type: 'string', description: 'newest | active | oldest' },
        title: { type: 'string', description: 'New title (omit to keep current)' },
        content: { type: 'string', description: 'Text to set/append/prepend' },
        mode: { type: 'string', description: 'set | append | prepend | clear', enum: ['set','append','prepend','clear'] }
      },
      required: []
    }
  },
  {
    name: 'close_window',
    description: 'Closes an existing window by its ID. Use this when the user wants to close, dismiss, or hide a specific window.',
    parameters: {
      type: 'object',
      properties: {
        windowId: {
          type: 'string',
          description: 'The unique identifier of the window to close'
        },
        selector: {
          type: 'string',
          description: 'Semantic selector when ID is unknown (newest/latest/oldest/active/all)'
        }
      },
      required: []
    }
  },
  {
    name: 'web_search',
    description: 'Performs web search using Gemini with grounding and displays results in a window. Use this when user wants to search for information online.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up'
        },
        resultCount: {
          type: 'number',
          description: 'Number of results to return (1-10, default 5)'
        },
        displayMode: {
          type: 'string',
          description: 'How to display results: summary (single result with summary), links (multiple results with titles/links), full (single result with full content)',
          enum: ['summary', 'links', 'full', 'auto']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'create_group',
    description: 'Creates a new window group with a name and color for organizing windows',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the group (e.g., Research, Work, Personal)'
        },
        color: {
          type: 'string',
          description: 'Color for the group banner (e.g., purple, blue, red, green, orange)'
        }
      },
      required: ['name', 'color']
    }
  },
  {
    name: 'assign_group',
    description: 'Assigns a window to a group or moves the current/newest window to a group',
    parameters: {
      type: 'object',
      properties: {
        windowId: {
          type: 'string',
          description: 'ID of the window to assign (optional, defaults to newest)'
        },
        groupName: {
          type: 'string',
          description: 'Name of the group to assign the window to'
        },
        selector: {
          type: 'string',
          description: 'Window selector if ID not provided (newest, active, all)'
        }
      },
      required: ['groupName']
    }
  },
  {
    name: 'open_webview',
    description: 'Opens a sandboxed webview (iframe) to display a URL inside a window.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to load in the webview' },
        title: { type: 'string', description: 'Optional window title' },
        width: { type: 'number', description: 'Optional window width in px' },
        height: { type: 'number', description: 'Optional window height in px' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_search_result',
    description: 'Opens one of the last shown search results in a webview (supports "first/second/N").',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '1-based index of the result to open (default 1)' },
        url: { type: 'string', description: 'Direct URL to open (overrides index lookup)' },
        title: { type: 'string', description: 'Optional window title' }
      },
      required: []
    }
  },
  {
    name: 'summarize_article',
    description: 'Reads the given URL server-side and generates a concise bullet summary and notes.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Article URL to read (will use reader mode)' },
        windowId: { type: 'string', description: 'Optional target window id for notes; default opens new' },
        maxBullets: { type: 'number', description: 'Max bullets in summary (default 8)' }
      },
      required: ['url']
    }
  }
];

export function getToolByName(name: string): Tool | undefined {
  return AVAILABLE_TOOLS.find(tool => tool.name === name);
}

export function getAllToolNames(): string[] {
  return AVAILABLE_TOOLS.map(tool => tool.name);
}
