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
  }
];

export function getToolByName(name: string): Tool | undefined {
  return AVAILABLE_TOOLS.find(tool => tool.name === name);
}

export function getAllToolNames(): string[] {
  return AVAILABLE_TOOLS.map(tool => tool.name);
}
