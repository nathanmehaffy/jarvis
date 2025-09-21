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
    name: 'show_integral_visual',
    description: 'Open a graph window visualizing a single-variable integral with LaTeX header.',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Expression in variable, e.g., sin(x) + x^2' },
        variable: { type: 'string', description: 'Variable name, default x' },
        lower: { type: 'number', description: 'Lower bound a' },
        upper: { type: 'number', description: 'Upper bound b' },
        samples: { type: 'number', description: 'Sampling count (default 200)' },
        title: { type: 'string', description: 'Optional window title' }
      },
      required: ['expression', 'lower', 'upper']
    }
  },
  {
    name: 'start_adaptive_quiz',
    description: 'Start an adaptive quiz window by topic (e.g., addition). The quiz listens to voice answers and adjusts difficulty.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Quiz topic, e.g., addition' }
      },
      required: ['topic']
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
    name: 'create_group',
    description: 'Create a new category/group by name. Use when the user says “create/make a category/group <name>”.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category/group name' },
        color: { type: 'string', description: 'Optional hex color like #3B82F6' }
      },
      required: ['name']
    }
  },
  {
    name: 'assign_group',
    description: 'Assign a window to a category/group. Use when the user says “assign this/window <id>/<title> to <group>”.',
    parameters: {
      type: 'object',
      properties: {
        groupName: { type: 'string', description: 'Target category/group name' },
        windowId: { type: 'string', description: 'Optional explicit window id' },
        selector: { type: 'string', description: 'Selector when no id provided (newest/latest/active/all)' }
      },
      required: ['groupName']
    }
  },
  {
    name: 'collapse_group',
    description: 'Collapse a category/group into a single summary window.',
    parameters: {
      type: 'object',
      properties: {
        groupName: { type: 'string', description: 'Category/group to collapse' }
      },
      required: ['groupName']
    }
  },
  {
    name: 'expand_group',
    description: 'Expand a previously-collapsed category/group, restoring its windows.',
    parameters: {
      type: 'object',
      properties: {
        groupName: { type: 'string', description: 'Category/group to expand' }
      },
      required: ['groupName']
    }
  }
];

export function getToolByName(name: string): Tool | undefined {
  return AVAILABLE_TOOLS.find(tool => tool.name === name);
}

export function getAllToolNames(): string[] {
  return AVAILABLE_TOOLS.map(tool => tool.name);
}
