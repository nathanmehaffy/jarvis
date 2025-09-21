import { Tool } from './types';

export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: 'organize_windows',
    description: 'Organizes and optimizes the layout of all open windows on the screen. Use this when user asks to organize, arrange, tidy up, optimize, or clean up the windows.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'edit_window',
    description: 'Edit an existing window by id or title, updating its title and/or content.',
    parameters: {
      type: 'object',
      properties: {
        windowId: { type: 'string', description: 'The window id to edit' },
        titleMatch: { type: 'string', description: 'Case-insensitive title to match an existing window' },
        newTitle: { type: 'string', description: 'New title to set' },
        newContent: { type: 'string', description: 'New content to set' }
      },
      required: []
    }
  },
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
    name: 'search',
    description: 'Performs a web-grounded search using AI and displays results in a new window. Use for queries like "search for [topic]" or "find information about [subject]".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or topic to research'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'open_webview',
    description: 'Opens a sandboxed webview (iframe) to display a URL inside a window. Use this to show a webpage.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to load in the webview' },
        title: { type: 'string', description: 'Optional window title' }
      },
      required: ['url']
    }
  },
  {
    name: 'summarize_article',
    description: 'Reads a URL, extracts the main content, and generates a concise bullet-point summary in a new window.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Article URL to read and summarize' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_search_result',
    description: 'Opens one of the links from the most recent search result. Use commands like "open the first link" or "show me the third result".',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '1-based index of the search result to open (default 1)' }
      },
      required: ['index']
    }
  },
  {
    name: 'analyze_pdf',
    description: 'Prompts the user to upload a PDF file, then analyzes and summarizes its content in a new window.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'A question or prompt about the PDF content, e.g., "Summarize this document."' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'create_task',
    description: 'Creates a new task in the task list. Use for reminders like "remind me to..." or "add a task to...".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title or content of the task' },
        due: { type: 'string', description: 'An optional due date or time in natural language (e.g., "tomorrow at 5pm")' }
      },
      required: ['title']
    }
  },
  {
    name: 'view_tasks',
    description: 'Opens a window displaying the current list of tasks.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'set_reminder',
    description: 'Schedules a one-time notification to appear at a future time.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The reminder message to display' },
        time: { type: 'string', description: 'When to send the reminder, in natural language (e.g., "in 10 minutes", "at 3:30pm")' }
      },
      required: ['message', 'time']
    }
  }
];

export function getToolByName(name: string): Tool | undefined {
  return AVAILABLE_TOOLS.find(tool => tool.name === name);
}

export function getAllToolNames(): string[] {
  return AVAILABLE_TOOLS.map(tool => tool.name);
}
